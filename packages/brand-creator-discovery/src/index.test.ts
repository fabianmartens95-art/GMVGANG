import { describe, expect, it } from "vitest";

import {
  authorizeCreatorBrandVisibilityTransition,
  buildBrandCreatorDiscoveryReadModel,
  buildCreatorDiscoveryReviewQueue,
  type BrandCreatorCandidate,
} from "./index.js";

const creators: BrandCreatorCandidate[] = [
  {
    creatorProfileId: "creator-hidden",
    displayName: "Hidden Creator",
    tiktokHandle: "hidden.creator",
    market: "DE",
    language: "de",
    niches: ["Beauty"],
    visibility: "hidden",
    performance: { orders: 999, gmV: 99999, postedContent: 50 },
  },
  {
    creatorProfileId: "creator-eligible",
    displayName: "Eligible Creator",
    tiktokHandle: "eligible.creator",
    market: "DE",
    language: "de",
    niches: ["Beauty"],
    visibility: "eligible",
  },
  {
    creatorProfileId: "creator-beauty",
    displayName: "Beauty Berlin",
    tiktokHandle: "beauty.berlin",
    market: "DE",
    language: "de",
    niches: ["Beauty", "Lifestyle"],
    visibility: "discoverable",
    performance: { orders: 120, gmV: 24000, postedContent: 16, updatedAt: "2026-09-17T18:00:00.000Z" },
  },
  {
    creatorProfileId: "creator-gaming",
    displayName: "Gaming Creator",
    tiktokHandle: "game.creator",
    market: "DE",
    language: "de",
    niches: ["Gaming"],
    visibility: "discoverable",
    performance: { orders: 20, gmV: 4000, postedContent: 8 },
  },
  {
    creatorProfileId: "creator-fr",
    displayName: "Paris Beauty",
    tiktokHandle: "paris.beauty",
    market: "FR",
    language: "fr",
    niches: ["Beauty"],
    visibility: "discoverable",
  },
];

describe("buildBrandCreatorDiscoveryReadModel", () => {
  it("fails closed: hidden and merely eligible Creators never enter Brand discovery", () => {
    const model = buildBrandCreatorDiscoveryReadModel(creators);
    expect(model.totalEligible).toBe(3);
    expect(model.creators.map((creator) => creator.creatorProfileId)).toEqual([
      "creator-beauty",
      "creator-gaming",
      "creator-fr",
    ]);
    expect(JSON.stringify(model)).not.toContain("creator-hidden");
    expect(JSON.stringify(model)).not.toContain("creator-eligible");
  });

  it("filters by market, language, niche and minimum performance", () => {
    const model = buildBrandCreatorDiscoveryReadModel(creators, {
      market: "DE",
      language: "de",
      niches: ["Beauty"],
      minimumOrders: 50,
      minimumGmv: 10000,
    });

    expect(model.totalMatches).toBe(1);
    expect(model.creators[0]).toMatchObject({
      creatorProfileId: "creator-beauty",
      market: "DE",
      language: "de",
      matchScore: 65,
    });
  });

  it("ranks explicit matching signals before operational volume", () => {
    const model = buildBrandCreatorDiscoveryReadModel(creators, {
      query: "beauty",
      market: "DE",
      language: "de",
      niches: ["Beauty"],
    });

    expect(model.creators.map((creator) => creator.creatorProfileId)).toEqual(["creator-beauty"]);
    expect(model.creators[0]?.matchReasons).toEqual([
      "1 Nischen-Match",
      "Markt passt",
      "Sprache passt",
      "Handle passt zur Suche",
      "Bestellungen vorhanden",
      "Content-Historie vorhanden",
    ]);
  });

  it("normalizes duplicate filters and rejects invalid thresholds", () => {
    const model = buildBrandCreatorDiscoveryReadModel(creators, {
      niches: [" Beauty ", "beauty", "Lifestyle"],
    });
    expect(model.filters.niches).toEqual(["Beauty", "Lifestyle"]);

    expect(() => buildBrandCreatorDiscoveryReadModel(creators, { minimumOrders: -1 }))
      .toThrow("CREATOR_DISCOVERY_MINIMUM_ORDERS_INVALID");
    expect(() => buildBrandCreatorDiscoveryReadModel(creators, { minimumGmv: Number.NaN }))
      .toThrow("CREATOR_DISCOVERY_MINIMUM_GMV_INVALID");
  });
});

describe("Creator Brand visibility governance", () => {
  it("requires creator opt-in before staff may make a Creator discoverable", () => {
    expect(authorizeCreatorBrandVisibilityTransition({
      current: "eligible",
      target: "discoverable",
      creatorOptedIn: false,
      actorCanManageCreators: true,
    })).toEqual({ ok: false, error: "CREATOR_DISCOVERY_OPT_IN_REQUIRED" });

    expect(authorizeCreatorBrandVisibilityTransition({
      current: "eligible",
      target: "discoverable",
      creatorOptedIn: true,
      actorCanManageCreators: true,
    })).toEqual({ ok: true });
  });

  it("requires a staff capability for every visibility mutation", () => {
    expect(authorizeCreatorBrandVisibilityTransition({
      current: "hidden",
      target: "eligible",
      creatorOptedIn: true,
      actorCanManageCreators: false,
    })).toEqual({ ok: false, error: "CREATOR_DISCOVERY_MANAGEMENT_DENIED" });
  });

  it("prevents hidden Creators from skipping the eligibility review state", () => {
    expect(authorizeCreatorBrandVisibilityTransition({
      current: "hidden",
      target: "discoverable",
      creatorOptedIn: true,
      actorCanManageCreators: true,
    })).toEqual({ ok: false, error: "CREATOR_DISCOVERY_INVALID_TRANSITION" });
  });

  it("allows staff to immediately hide a previously discoverable Creator", () => {
    expect(authorizeCreatorBrandVisibilityTransition({
      current: "discoverable",
      target: "hidden",
      creatorOptedIn: true,
      actorCanManageCreators: true,
    })).toEqual({ ok: true });
  });
});

describe("Creator discovery moderation queue", () => {
  it("prioritizes Creators that are ready for final staff approval", () => {
    const queue = buildCreatorDiscoveryReviewQueue([
      {
        creatorProfileId: "hidden-1",
        displayName: "Hidden",
        tiktokHandle: "hidden.one",
        visibility: "hidden",
        creatorOptedIn: true,
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
      {
        creatorProfileId: "eligible-waiting",
        displayName: "Waiting",
        tiktokHandle: "waiting.one",
        visibility: "eligible",
        creatorOptedIn: false,
        updatedAt: "2026-09-17T23:00:00.000Z",
      },
      {
        creatorProfileId: "eligible-ready",
        displayName: "Ready",
        tiktokHandle: "ready.one",
        visibility: "eligible",
        creatorOptedIn: true,
        updatedAt: "2026-09-18T00:30:00.000Z",
      },
    ]);

    expect(queue.map((item) => [item.creatorProfileId, item.state, item.nextAction])).toEqual([
      ["eligible-ready", "ready_for_staff_approval", "approve_discoverability"],
      ["hidden-1", "needs_eligibility_review", "review_eligibility"],
      ["eligible-waiting", "waiting_creator_opt_in", "wait_for_creator_opt_in"],
    ]);
  });

  it("excludes already discoverable Creators from the default moderation queue", () => {
    const candidate = {
      creatorProfileId: "live-1",
      displayName: "Live Creator",
      tiktokHandle: "live.creator",
      visibility: "discoverable" as const,
      creatorOptedIn: true,
      updatedAt: "2026-09-18T00:00:00.000Z",
    };

    expect(buildCreatorDiscoveryReviewQueue([candidate])).toEqual([]);
    expect(buildCreatorDiscoveryReviewQueue([candidate], { includeDiscoverable: true })[0])
      .toMatchObject({ state: "already_discoverable", nextAction: "none" });
  });

  it("orders equal review states by oldest waiting item first", () => {
    const queue = buildCreatorDiscoveryReviewQueue([
      {
        creatorProfileId: "newer",
        displayName: "Newer",
        tiktokHandle: "newer.creator",
        visibility: "hidden",
        creatorOptedIn: false,
        updatedAt: "2026-09-18T01:00:00.000Z",
      },
      {
        creatorProfileId: "older",
        displayName: "Older",
        tiktokHandle: "older.creator",
        visibility: "hidden",
        creatorOptedIn: false,
        updatedAt: "2026-09-17T22:00:00.000Z",
      },
    ]);

    expect(queue.map((item) => item.creatorProfileId)).toEqual(["older", "newer"]);
  });
});
