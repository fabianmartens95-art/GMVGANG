import { describe, expect, it } from "vitest";
import {
  HttpBrandCreatorDiscoveryAdapter,
  parseBrandCreatorDiscovery,
  renderBrandCreatorDiscovery,
} from "../src/brand-creator-discovery.js";

const CREATOR = {
  creatorProfileId: "creator-1",
  displayName: "Beauty <Creator>",
  tiktokHandle: "beauty.creator",
  market: "DE",
  language: "de",
  niches: ["Beauty", "Lifestyle"],
  verification: "verified",
  performance: {
    gmVCents: 123400,
    orders: 42,
    postedContent: 8,
    updatedAt: "2026-09-18T00:00:00.000Z",
  },
  matchScore: 85,
  matchReasons: ["Markt passt", "Beauty <Match>"],
};

describe("Brand Creator Discovery surface", () => {
  it("accepts only approved public profile fields plus ranking metadata", () => {
    const response = parseBrandCreatorDiscovery({
      totalMatches: 1,
      creators: [CREATOR],
    });

    expect(response.creators[0]).toEqual(CREATOR);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("visibility");
    expect(serialized).not.toContain("creatorMasterId");
  });

  it("rejects internal PII and visibility-governance fields", () => {
    for (const extra of [
      { email: "private@example.com" },
      { userId: "user-secret" },
      { referralCode: "SECRET" },
      { creatorMasterId: "notion-secret" },
      { internalNotes: "private" },
      { visibility: "discoverable" },
      { creatorOptedIn: true },
    ]) {
      expect(() => parseBrandCreatorDiscovery({
        totalMatches: 1,
        creators: [{ ...CREATOR, ...extra }],
      })).toThrow("BRAND_DISCOVERY_ROW_INVALID");
    }
  });

  it("rejects duplicate Creator ids and total-count mismatches", () => {
    expect(() => parseBrandCreatorDiscovery({
      totalMatches: 2,
      creators: [CREATOR, { ...CREATOR }],
    })).toThrow("BRAND_DISCOVERY_DUPLICATE_CREATOR");

    expect(() => parseBrandCreatorDiscovery({
      totalMatches: 2,
      creators: [CREATOR],
    })).toThrow("BRAND_DISCOVERY_TOTAL_MISMATCH");
  });

  it("fails closed on malformed public performance or ranking values", () => {
    expect(() => parseBrandCreatorDiscovery({
      totalMatches: 1,
      creators: [{
        ...CREATOR,
        performance: { ...CREATOR.performance, orders: -1 },
      }],
    })).toThrow("BRAND_DISCOVERY_PERFORMANCE_INVALID");

    expect(() => parseBrandCreatorDiscovery({
      totalMatches: 1,
      creators: [{
        ...CREATOR,
        performance: { ...CREATOR.performance, updatedAt: "not-a-date" },
      }],
    })).toThrow("BRAND_DISCOVERY_PERFORMANCE_INVALID");

    expect(() => parseBrandCreatorDiscovery({
      totalMatches: 1,
      creators: [{ ...CREATOR, matchScore: 101 }],
    })).toThrow("BRAND_DISCOVERY_ROW_INVALID");
  });

  it("escapes Brand-facing Creator strings and never renders raw GMV without currency", () => {
    const html = renderBrandCreatorDiscovery(parseBrandCreatorDiscovery({
      totalMatches: 1,
      creators: [CREATOR],
    }));

    expect(html).toContain("Beauty &lt;Creator&gt;");
    expect(html).toContain("Beauty &lt;Match&gt;");
    expect(html).not.toContain("<Creator>");
    expect(html).not.toContain("123400");
    expect(html).toContain("42 Orders");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandCreatorDiscoveryAdapter(
      "org-1",
      "/api/brand/creators/discovery",
      async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          async json() { return { totalMatches: 1, creators: [CREATOR] }; },
        };
      },
    );

    await expect(adapter.getCreators()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/creators/discovery",
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
    const adapter = new HttpBrandCreatorDiscoveryAdapter(
      " ",
      "/api/brand/creators/discovery",
      async () => {
        called = true;
        return { ok: true, async json() { return { totalMatches: 0, creators: [] }; } };
      },
    );

    await expect(adapter.getCreators()).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it("renders explicit unavailable and empty states", () => {
    expect(renderBrandCreatorDiscovery(null)).toContain("Creator nicht verfügbar");
    expect(renderBrandCreatorDiscovery({ totalMatches: 0, creators: [] }))
      .toContain("Keine freigegebenen Treffer");
  });
});
