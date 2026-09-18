import { describe, expect, it } from "vitest";
import {
  HttpCreatorTikTokConnectionAdapter,
  parseCreatorTikTokConnection,
  renderCreatorTikTokConnection,
} from "../src/creator-tiktok-connection.js";

const CONNECTED = {
  state: "connected",
  nextAction: "none",
  market: "DE",
  externalShopIds: ["shop-1"],
  grantedScopes: ["data.shop.public.read"],
  lastSyncAt: "2026-09-18T12:00:00.000Z",
  lastErrorCode: null,
};

describe("Creator TikTok connection surface", () => {
  it("renders public connection metadata without a mutation control", () => {
    const html = renderCreatorTikTokConnection(
      parseCreatorTikTokConnection(CONNECTED),
    );

    expect(html).toContain("TikTok verbunden");
    expect(html).toContain("shop-1");
    expect(html).toContain("data.shop.public.read");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("accessToken");
    expect(html).not.toContain("refreshToken");
  });

  it("enforces exact state to next-action consistency", () => {
    const matrix = [
      ["disconnected", "connect_tiktok"],
      ["connecting", "finish_tiktok_connection"],
      ["connected", "none"],
      ["refresh_required", "refresh_tiktok_connection"],
      ["reconnect_required", "reconnect_tiktok"],
    ] as const;

    for (const [state, nextAction] of matrix) {
      const base = {
        state,
        nextAction,
        market: state === "disconnected" ? null : "DE",
        externalShopIds: state === "disconnected" ? [] : ["shop-1"],
        grantedScopes:
          state === "disconnected" ? [] : ["data.shop.public.read"],
        lastSyncAt:
          state === "disconnected" ? null : "2026-09-18T12:00:00.000Z",
        lastErrorCode:
          state === "reconnect_required" ? "CONNECTION_EXPIRED" : null,
      };

      expect(parseCreatorTikTokConnection(base).nextAction).toBe(nextAction);
      expect(() => parseCreatorTikTokConnection({
        ...base,
        nextAction: state === "connected"
          ? "connect_tiktok"
          : "none",
      })).toThrow("CREATOR_TIKTOK_CONNECTION_STATE_INCONSISTENT");
    }
  });

  it("rejects token, secret, expiry, provider-account and credential fields", () => {
    for (const extra of [
      { externalAccountId: "provider-account-1" },
      { accessToken: "secret" },
      { refreshToken: "secret" },
      { accessTokenSecretRef: "secret://access" },
      { refreshTokenSecretRef: "secret://refresh" },
      { tokenExpiresAt: "2026-10-01T00:00:00.000Z" },
      { clientSecret: "secret" },
      { shopCipher: "cipher" },
    ]) {
      expect(() => parseCreatorTikTokConnection({
        ...CONNECTED,
        ...extra,
      })).toThrow("CREATOR_TIKTOK_CONNECTION_PAYLOAD_INVALID");
    }
  });

  it("rejects duplicate/malformed shops or scopes", () => {
    expect(() => parseCreatorTikTokConnection({
      ...CONNECTED,
      externalShopIds: ["shop-1", "shop-1"],
    })).toThrow("CREATOR_TIKTOK_CONNECTION_LIST_INVALID");

    expect(() => parseCreatorTikTokConnection({
      ...CONNECTED,
      grantedScopes: [" "],
    })).toThrow("CREATOR_TIKTOK_CONNECTION_LIST_INVALID");
  });

  it("does not invent metadata invariants beyond the canonical lifecycle core", () => {
    expect(parseCreatorTikTokConnection({
      state: "disconnected",
      nextAction: "connect_tiktok",
      market: "DE",
      externalShopIds: ["shop-1"],
      grantedScopes: ["data.shop.public.read"],
      lastSyncAt: "2026-09-18T12:00:00.000Z",
      lastErrorCode: "PREVIOUS_ERROR",
    })).toMatchObject({
      state: "disconnected",
      nextAction: "connect_tiktok",
      market: "DE",
      lastErrorCode: "PREVIOUS_ERROR",
    });

    expect(parseCreatorTikTokConnection({
      ...CONNECTED,
      lastErrorCode: "PREVIOUS_ERROR",
    }).lastErrorCode).toBe("PREVIOUS_ERROR");
  });

  it("validates timestamps and public metadata", () => {
    expect(() => parseCreatorTikTokConnection({
      ...CONNECTED,
      lastSyncAt: "not-a-date",
    })).toThrow("CREATOR_TIKTOK_CONNECTION_TIMESTAMP_INVALID");

    expect(() => parseCreatorTikTokConnection({
      ...CONNECTED,
      market: "",
    })).toThrow("CREATOR_TIKTOK_CONNECTION_METADATA_INVALID");
  });

  it("keeps Creator identity server-derived with no browser selector", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorTikTokConnectionAdapter(
      "/api/creator/tiktok-shop/connection",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return CONNECTED; } };
      },
    );

    await expect(adapter.getConnection()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/tiktok-shop/connection",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("routes every connection action only to the existing onboarding route", () => {
    for (const [state, nextAction] of [
      ["disconnected", "connect_tiktok"],
      ["connecting", "finish_tiktok_connection"],
      ["refresh_required", "refresh_tiktok_connection"],
      ["reconnect_required", "reconnect_tiktok"],
    ] as const) {
      const response = parseCreatorTikTokConnection({
        state,
        nextAction,
        market: state === "disconnected" ? null : "DE",
        externalShopIds: state === "disconnected" ? [] : ["shop-1"],
        grantedScopes:
          state === "disconnected" ? [] : ["data.shop.public.read"],
        lastSyncAt:
          state === "disconnected" ? null : "2026-09-18T12:00:00.000Z",
        lastErrorCode:
          state === "reconnect_required" ? "CONNECTION_EXPIRED" : null,
      });
      const html = renderCreatorTikTokConnection(response);
      expect(html).toContain('href="/creator/onboarding"');
      expect(html).not.toContain("/oauth");
      expect(html).not.toContain("/callback");
    }
  });
});
