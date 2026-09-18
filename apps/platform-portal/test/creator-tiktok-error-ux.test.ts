import { describe, expect, it } from "vitest";
import {
  creatorTikTokSyncFailurePresentation,
  creatorTikTokSyncingPresentation,
  renderCreatorOnboarding,
  type ParallelV1Snapshot,
} from "../src/parallel-v1.js";
import {
  parseCreatorTikTokConnection,
  renderCreatorTikTokConnection,
} from "../src/creator-tiktok-connection.js";

function connectedSnapshot(): ParallelV1Snapshot {
  return {
    ok: true,
    generatedAt: "2026-09-19T00:00:00.000Z",
    brand: null,
    creator: {
      creatorProfileId: "creator-1",
      onboarding: {
        creator_profile_id: "creator-1",
        follower_count: 118248,
        follower_count_source: "tiktok",
        follower_count_verified_at: "2026-09-18T18:32:00.000Z",
        content_formats: ["shoppable_video"],
        live_status: "occasional",
        onboarding_status: "complete",
        onboarding_completion_percent: 100,
        next_best_action: "review_opportunities",
      },
      tiktok: {
        available: true,
        connection: {
          status: "connected",
          username: "petrus.lives",
          display_name: "Petrus",
          avatar_url: null,
          is_verified: false,
          granted_scopes: ["user.info.basic", "user.info.stats"],
          follower_count: 118248,
          following_count: 123,
          likes_count: 456789,
          video_count: 309,
          connected_at: "2026-09-18T18:00:00.000Z",
          last_synced_at: "2026-09-18T18:32:00.000Z",
        },
      },
      assignments: [],
      campaigns: [],
    },
    activity: [],
  };
}

describe("Creator TikTok error UX", () => {
  it("renders connected truth and the last successful sync separately", () => {
    const html = renderCreatorOnboarding(connectedSnapshot());

    expect(html).toContain('data-tiktok-state="connected"');
    expect(html).toContain("Verbunden");
    expect(html).toContain("@petrus.lives");
    expect(html).toContain("Letzter erfolgreicher Sync:");
    expect(html).toContain("Jetzt synchronisieren");
    expect(html).toContain("Verbindung trennen");
  });

  it("models syncing as a transient state without disconnecting the account", () => {
    const presentation = creatorTikTokSyncingPresentation();

    expect(presentation.state).toBe("syncing");
    expect(presentation.title).toBe("Synchronisierung läuft");
    expect(presentation.detail).toContain("Verbindung bleibt");
    expect(presentation.recovery).toBe("none");
  });

  it("keeps generic sync failures connected and exposes a retry instead of a backend code", () => {
    const presentation = creatorTikTokSyncFailurePresentation("tiktok_integration_failed");

    expect(presentation.state).toBe("sync_failed");
    expect(presentation.recovery).toBe("retry");
    expect(presentation.title).toBe("Synchronisierung fehlgeschlagen");
    expect(presentation.detail).toContain("Verbindung besteht weiter");
    expect(JSON.stringify(presentation)).not.toContain("tiktok_integration_failed");
  });

  it("maps reauthorization failures to reconnect instead of retry", () => {
    const presentation = creatorTikTokSyncFailurePresentation("tiktok_reauthorization_required");

    expect(presentation.state).toBe("disconnected");
    expect(presentation.recovery).toBe("reconnect");
    expect(presentation.title).toBe("TikTok-Verbindung erneuern");
    expect(JSON.stringify(presentation)).not.toContain("tiktok_reauthorization_required");
  });

  it("renders unusable server connection states as reconnect-required", () => {
    const snapshot = connectedSnapshot();
    if (!snapshot.creator?.tiktok.connection) throw new Error("test fixture missing connection");
    snapshot.creator.tiktok.connection.status = "error";

    const html = renderCreatorOnboarding(snapshot);

    expect(html).toContain('data-tiktok-state="disconnected"');
    expect(html).toContain("TikTok-Verbindung erneuern");
    expect(html).toContain("Erneut verbinden");
    expect(html).not.toContain("Statuscode:");
  });

  it("never renders the dedicated connection surface's internal error code", () => {
    const response = parseCreatorTikTokConnection({
      state: "connected",
      nextAction: "none",
      market: "DE",
      externalShopIds: ["shop-1"],
      grantedScopes: ["data.shop.public.read"],
      lastSyncAt: "2026-09-18T18:32:00.000Z",
      lastErrorCode: "TIKTOK_REFRESH_FAILED",
    });

    const html = renderCreatorTikTokConnection(response);

    expect(html).toContain("letzte TikTok-Aktualisierung");
    expect(html).not.toContain("TIKTOK_REFRESH_FAILED");
    expect(html).not.toContain("Statuscode:");
  });
});
