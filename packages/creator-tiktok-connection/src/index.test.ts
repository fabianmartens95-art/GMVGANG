import { describe, expect, it } from "vitest";
import type { ExternalConnection } from "@gmvgang/platform-foundation";

import {
  authorizeCreatorTikTokConnectionTransition,
  buildCreatorTikTokConnectionReadModel,
} from "./index.js";

const NOW = "2026-09-18T00:00:00.000Z";

function connection(overrides: Partial<ExternalConnection> = {}): ExternalConnection {
  return {
    id: "connection-1",
    ownerType: "creator_profile",
    ownerId: "creator-1",
    provider: "tiktok_shop_creator",
    status: "connected",
    market: "DE",
    externalAccountId: "tt-account-1",
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

describe("Creator TikTok connection", () => {
  it("guides a disconnected Creator into connection", () => {
    expect(buildCreatorTikTokConnectionReadModel(null, { now: NOW }))
      .toMatchObject({
        state: "disconnected",
        nextAction: "connect_tiktok",
      });
  });

  it("shows connected state without exposing token secret references", () => {
    const model = buildCreatorTikTokConnectionReadModel(connection(), { now: NOW });

    expect(model).toMatchObject({
      state: "connected",
      nextAction: "none",
      externalAccountId: "tt-account-1",
      externalShopIds: ["shop-1"],
    });
    expect(JSON.stringify(model)).not.toContain("secret://");
  });

  it("requires refresh shortly before expiry when a refresh secret exists", () => {
    expect(buildCreatorTikTokConnectionReadModel(connection({
      tokenExpiresAt: "2026-09-18T00:20:00.000Z",
    }), {
      now: NOW,
      refreshWithinMinutes: 30,
    })).toMatchObject({
      state: "refresh_required",
      nextAction: "refresh_tiktok_connection",
    });
  });

  it("requires reconnect for expired, revoked, or errored connections", () => {
    for (const status of ["expired", "revoked", "error"] as const) {
      expect(buildCreatorTikTokConnectionReadModel(connection({ status }), { now: NOW }))
        .toMatchObject({
          state: "reconnect_required",
          nextAction: "reconnect_tiktok",
        });
    }

    expect(buildCreatorTikTokConnectionReadModel(connection({
      tokenExpiresAt: "2026-09-17T23:59:59.000Z",
    }), { now: NOW })).toMatchObject({
      state: "reconnect_required",
      nextAction: "reconnect_tiktok",
    });
  });

  it("fails closed on Seller connections or wrong ownership", () => {
    expect(() => buildCreatorTikTokConnectionReadModel(connection({
      provider: "tiktok_shop_seller",
      ownerType: "organization",
    }), { now: NOW })).toThrow("CREATOR_TIKTOK_CONNECTION_IDENTITY_INVALID");
  });

  it("enforces explicit lifecycle transitions", () => {
    expect(authorizeCreatorTikTokConnectionTransition({
      from: "none",
      to: "pending",
    })).toEqual({ ok: true });

    expect(authorizeCreatorTikTokConnectionTransition({
      from: "pending",
      to: "connected",
    })).toEqual({ ok: true });

    expect(authorizeCreatorTikTokConnectionTransition({
      from: "connected",
      to: "pending",
    })).toEqual({
      ok: false,
      error: "CREATOR_TIKTOK_CONNECTION_TRANSITION_DENIED",
    });

    expect(authorizeCreatorTikTokConnectionTransition({
      from: "revoked",
      to: "pending",
    })).toEqual({ ok: true });
  });
});
