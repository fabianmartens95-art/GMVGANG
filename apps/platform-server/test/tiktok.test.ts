import { describe, expect, it } from "vitest";

import {
  buildTikTokAuthorizeUrl,
  decryptTikTokToken,
  encryptTikTokToken,
  existingTikTokConnectionTokenFields,
  tiktokIdentityDigest,
  tiktokUserFieldsForScopes,
} from "../src/tiktok.js";

describe("TikTok Creator integration helpers", () => {
  it("encrypts OAuth tokens at rest and round-trips them with AES-GCM", () => {
    const key = Buffer.alloc(32, 11).toString("base64");
    const encrypted = encryptTikTokToken("access-token-secret", key);

    expect(encrypted).not.toContain("access-token-secret");
    expect(decryptTikTokToken(encrypted, key)).toBe("access-token-secret");
    expect(() => decryptTikTokToken(encrypted.slice(0, -2) + "aa", key)).toThrow();
  });

  it("HMAC-protects TikTok provider identities with domain separation", () => {
    const key = "identity-hash-key-that-is-at-least-32-bytes";
    const openId = tiktokIdentityDigest("open_id", "provider-user-id", key);
    const unionId = tiktokIdentityDigest("union_id", "provider-user-id", key);

    expect(openId).toMatch(/^[a-f0-9]{64}$/);
    expect(unionId).toMatch(/^[a-f0-9]{64}$/);
    expect(openId).not.toBe(unionId);
    expect(openId).not.toContain("provider-user-id");
  });


  it("preserves stored token references and expiries when a connected profile is re-synced", () => {
    expect(existingTikTokConnectionTokenFields({
      access_token_secret_ref: "access-secret-ref",
      refresh_token_secret_ref: "refresh-secret-ref",
      access_token_expires_at: "2026-09-19T00:00:00.000Z",
      refresh_token_expires_at: "2027-09-18T00:00:00.000Z",
    })).toEqual({
      access_token_secret_ref: "access-secret-ref",
      refresh_token_secret_ref: "refresh-secret-ref",
      access_token_expires_at: "2026-09-19T00:00:00.000Z",
      refresh_token_expires_at: "2027-09-18T00:00:00.000Z",
    });

    expect(existingTikTokConnectionTokenFields(null)).toEqual({});
    expect(existingTikTokConnectionTokenFields({
      access_token_secret_ref: null,
      refresh_token_secret_ref: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
    })).toEqual({
      access_token_secret_ref: null,
      refresh_token_secret_ref: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
    });
  });

  it("only requests profile and stats fields when the corresponding scopes were granted", () => {
    expect(tiktokUserFieldsForScopes(["user.info.basic"])).toEqual([
      "open_id",
      "union_id",
      "avatar_url",
      "display_name",
    ]);

    expect(tiktokUserFieldsForScopes([
      "user.info.basic",
      "user.info.profile",
      "user.info.stats",
    ])).toEqual([
      "open_id",
      "union_id",
      "avatar_url",
      "display_name",
      "username",
      "is_verified",
      "follower_count",
      "following_count",
      "likes_count",
      "video_count",
    ]);
  });

  it("builds the official TikTok v2 authorization URL without exposing the client secret", () => {
    const url = buildTikTokAuthorizeUrl({
      clientKey: "client-key",
      clientSecret: "server-only-secret",
      tokenEncryptionKey: Buffer.alloc(32, 4).toString("base64"),
      identityHashKey: "identity-hash-key-that-is-at-least-32-bytes",
      redirectUri: "https://app.gmvgang.de/api/integrations/tiktok/callback",
      scopes: ["user.info.basic", "user.info.stats"],
    }, "csrf-state");

    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("client-key");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,user.info.stats");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.gmvgang.de/api/integrations/tiktok/callback");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.toString()).not.toContain("server-only-secret");
  });
});
