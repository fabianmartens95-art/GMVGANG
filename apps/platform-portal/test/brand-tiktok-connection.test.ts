import { describe, expect, it } from "vitest";
import {
  HttpBrandTikTokConnectionAdapter,
  parseBrandTikTokConnection,
  renderBrandTikTokConnection,
} from "../src/brand-tiktok-connection.js";

const CONNECTED = {
  state: "connected",
  nextAction: "none",
  market: "DE",
  externalAccountId: "seller-1",
  externalShopIds: ["shop-1"],
  grantedScopes: ["data.shop_analytics.public.read"],
  lastSyncAt: "2026-09-18T12:00:00.000Z",
  lastErrorCode: null,
};

describe("Brand TikTok Shop connection surface", () => {
  it("renders safe connected Seller metadata without a mutation control", () => {
    const html = renderBrandTikTokConnection(parseBrandTikTokConnection(CONNECTED));
    expect(html).toContain("TikTok Shop verbunden");
    expect(html).toContain("seller-1");
    expect(html).toContain("shop-1");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("accessToken");
  });

  it("maps every public connection state to exactly one canonical action", () => {
    const cases = [
      ["disconnected", "connect_tiktok_shop"],
      ["connecting", "finish_tiktok_shop_connection"],
      ["connected", "none"],
      ["refresh_required", "refresh_tiktok_shop_connection"],
      ["reconnect_required", "reconnect_tiktok_shop"],
    ] as const;

    for (const [state, nextAction] of cases) {
      expect(parseBrandTikTokConnection({
        ...CONNECTED,
        state,
        nextAction,
      }).nextAction).toBe(nextAction);
    }
  });

  it("fails closed on unknown or inconsistent state/action combinations", () => {
    expect(() => parseBrandTikTokConnection({
      ...CONNECTED,
      state: "expired",
    })).toThrow("BRAND_TIKTOK_CONNECTION_STATE_INVALID");

    expect(() => parseBrandTikTokConnection({
      ...CONNECTED,
      state: "connected",
      nextAction: "reconnect_tiktok_shop",
    })).toThrow("BRAND_TIKTOK_CONNECTION_STATE_INCONSISTENT");
  });

  it("rejects secret, token, cipher and credential fields", () => {
    for (const extra of [
      { accessTokenSecretRef: "secret://access" },
      { refreshTokenSecretRef: "secret://refresh" },
      { accessToken: "raw-token" },
      { refreshToken: "raw-refresh" },
      { shopCipher: "cipher" },
      { clientSecret: "secret" },
    ]) {
      expect(() => parseBrandTikTokConnection({
        ...CONNECTED,
        ...extra,
      })).toThrow("BRAND_TIKTOK_CONNECTION_PAYLOAD_INVALID");
    }
  });

  it("fails closed on malformed metadata, timestamps or duplicate lists", () => {
    expect(() => parseBrandTikTokConnection({
      ...CONNECTED,
      lastSyncAt: "not-a-date",
    })).toThrow("BRAND_TIKTOK_CONNECTION_TIMESTAMP_INVALID");

    expect(() => parseBrandTikTokConnection({
      ...CONNECTED,
      externalShopIds: ["shop-1", "shop-1"],
    })).toThrow("BRAND_TIKTOK_CONNECTION_LIST_INVALID");
  });

  it("escapes Seller metadata and points all connection actions only to Brand setup", () => {
    const html = renderBrandTikTokConnection(parseBrandTikTokConnection({
      ...CONNECTED,
      state: "reconnect_required",
      nextAction: "reconnect_tiktok_shop",
      externalAccountId: "<seller>",
      externalShopIds: ["<shop>"],
      grantedScopes: ["scope<unsafe>"],
      lastErrorCode: "<error>",
    }));

    expect(html).toContain("&lt;seller&gt;");
    expect(html).toContain("&lt;shop&gt;");
    expect(html).toContain("scope&lt;unsafe&gt;");
    expect(html).toContain("&lt;error&gt;");
    expect(html).toContain('href="/brand/setup"');
    expect(html).not.toContain("oauth");
    expect(html).not.toContain("callback");
  });

  it("keeps organization selection in the authenticated workspace header", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandTikTokConnectionAdapter(
      "org-1",
      "/api/brand/tiktok-shop/connection",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return CONNECTED; } };
      },
    );

    await expect(adapter.getConnection()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/tiktok-shop/connection",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("does not issue a request without organization context", async () => {
    let called = false;
    const adapter = new HttpBrandTikTokConnectionAdapter(
      " ",
      "/api/brand/tiktok-shop/connection",
      async () => {
        called = true;
        return { ok: true, async json() { return CONNECTED; } };
      },
    );
    await expect(adapter.getConnection()).resolves.toBeNull();
    expect(called).toBe(false);
  });
});
