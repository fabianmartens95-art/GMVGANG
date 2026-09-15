import { describe, expect, it } from "vitest";
import { matchCreators } from "./matching";
import { graph, product } from "./fixtures.test-helper";

describe("matchCreators", () => {
  it("ranks product fit and proven history ahead of raw creator size", () => {
    const results = matchCreators({ graph, product });
    expect(results[0]?.creatorId).toBe("beauty");
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(results[0]?.components).toHaveLength(7);
  });

  it("moves explicitly excluded creators below eligible creators", () => {
    const results = matchCreators({
      graph,
      product: { ...product, excludedCreatorIds: ["beauty"] }
    });
    expect(results.at(-1)?.creatorId).toBe("beauty");
    expect(results.at(-1)?.eligible).toBe(false);
    expect(results.at(-1)?.rejectionReasons).toContain("excluded");
  });

  it("validates limit and weights", () => {
    expect(() => matchCreators({ graph, product, limit: 0 })).toThrow("limit must be a positive integer");
    expect(() => matchCreators({ graph, product, weights: { categoryFit: 0 } })).toThrow(
      "matchWeights.categoryFit must be greater than 0"
    );
  });
});
