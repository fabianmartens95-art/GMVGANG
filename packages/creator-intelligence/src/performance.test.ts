import { describe, expect, it } from "vitest";
import { buildCreatorGraph } from "./validate";
import { scoreCreatorPerformance } from "./performance";
import { graph } from "./fixtures.test-helper";

describe("creator graph and performance", () => {
  it("returns an explainable performance score", () => {
    const creator = graph.creators[0];
    if (!creator) throw new Error("fixture missing");
    const result = scoreCreatorPerformance(creator);
    expect(result.score).toBeGreaterThan(70);
    expect(result.components.gmV).toBeGreaterThan(0);
    expect(result.components.sampleReliability).toBe(90);
  });

  it("rejects edges that reference unknown creators", () => {
    expect(() => buildCreatorGraph({
      creators: graph.creators,
      productEdges: [{ ...graph.productEdges[0]!, creatorId: "missing" }],
      brandEdges: []
    })).toThrow("edge references unknown creator: missing");
  });

  it("rejects duplicate creator ids", () => {
    const first = graph.creators[0];
    if (!first) throw new Error("fixture missing");
    expect(() => buildCreatorGraph({ creators: [first, first], productEdges: [], brandEdges: [] }))
      .toThrow("duplicate creator id: beauty");
  });
});
