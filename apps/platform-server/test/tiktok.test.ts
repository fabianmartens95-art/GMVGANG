import { describe, expect, it } from "vitest";

import {
  buildTikTokAuthorizeUrl,
  decryptTikTokToken,
  encryptTikTokToken,
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
