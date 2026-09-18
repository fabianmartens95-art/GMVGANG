import { describe, expect, it } from "vitest";
import type { ExternalConnection } from "@gmvgang/platform-foundation";

import {
  authorizeBrandTikTokConnectionTransition,
  buildBrandTikTokConnectionReadModel,
} from "./index.js";

const NOW = "2026-09-18T00:00:00.000Z";

function connection(overrides: Partial<ExternalConnection> = {}): ExternalConnection {
  return {
    id: "connection-1",
    ownerType: "organization",
    ownerId: "org-1",
    provider: "tiktok_shop_seller",
    status: "connected",
    market: "DE",
    externalAccountId: "seller-account-1",
    externalShopIds: ["shop-1"],
    grantedScopes: ["scope-a"],
    accessTokenSecretRef: "secret://access",
    refreshTokenSecretRef: "secret://refresh",
    tokenExpiresAt: "2026-09-18T04:00:00.000Z",
    lastSyncAt: "2026-09-17T23:30:00.000Z",
    createdAt: "2026-09-17T20:00:00.000Z",
    updatedAt: "2026-09-17T23:30:00.000Z",
    ...overrides,
  };
}

describe("Brand TikTok Shop connection", () => {
  it("guides a disconnected Brand into Seller connection", () => {
    expect(buildBrandTikTokConnectionReadModel(null, { now: NOW }))
      .toMatchObject({
        state: "disconnected",
        nextAction: "connect_tiktok_shop",
      });
  });

  it("exposes Seller account metadata without token secret references", () => {
    const model = buildBrandTikTokConnectionReadModel(connection(), { now: NOW });

    expect(model).toMatchObject({
      state: "connected",
      nextAction: "none",
      externalAccountId: "seller-account-1",
      externalShopIds: ["shop-1"],
    });
    expect(JSON.stringify(model)).not.toContain("secret://");
  });

  it("requires refresh shortly before token expiry when refresh is available", () => {
    expect(buildBrandTikTokConnectionReadModel(connection({
      tokenExpiresAt: "2026-09-18T00:20:00.000Z",
    }), {
      now: NOW,
      refreshWithinMinutes: 30,
    })).toMatchObject({
      state: "refresh_required",
      nextAction: "refresh_tiktok_shop_connection",
    });
  });

  it("requires reconnect for expired, revoked or errored Seller connections", () => {
    for (const status of ["expired", "revoked", "error"] as const) {
      expect(buildBrandTikTokConnectionReadModel(connection({ status }), { now: NOW }))
        .toMatchObject({
          state: "reconnect_required",
          nextAction: "reconnect_tiktok_shop",
        });
    }

    expect(buildBrandTikTokConnectionReadModel(connection({
      tokenExpiresAt: "2026-09-17T23:59:59.000Z",
    }), { now: NOW })).toMatchObject({
      state: "reconnect_required",
      nextAction: "reconnect_tiktok_shop",
    });
  });

  it("fails closed on Creator connections or wrong ownership", () => {
    expect(() => buildBrandTikTokConnectionReadModel(connection({
      provider: "tiktok_shop_creator",
      ownerType: "creator_profile",
    }), { now: NOW })).toThrow("BRAND_TIKTOK_CONNECTION_IDENTITY_INVALID");
  });

  it("enforces explicit lifecycle transitions", () => {
    expect(authorizeBrandTikTokConnectionTransition({
      from: "none",
      to: "pending",
    })).toEqual({ ok: true });

    expect(authorizeBrandTikTokConnectionTransition({
      from: "pending",
      to: "connected",
    })).toEqual({ ok: true });

    expect(authorizeBrandTikTokConnectionTransition({
      from: "connected",
      to: "pending",
    })).toEqual({
      ok: false,
      error: "BRAND_TIKTOK_CONNECTION_TRANSITION_DENIED",
    });

    expect(authorizeBrandTikTokConnectionTransition({
      from: "revoked",
      to: "pending",
    })).toEqual({ ok: true });
  });
});
