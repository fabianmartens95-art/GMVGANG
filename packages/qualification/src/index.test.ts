import { describe, expect, it } from "vitest";
import { qualifyBrand } from "./index";

describe("qualifyBrand", () => {
  it("calculates an explainable weighted score", () => {
    const result = qualifyBrand({
      thresholds: {
        qualifiedMinScore: 80,
        reviewMinScore: 60
      },
      criteria: [
        { id: "economics", score: 90, weight: 3 },
        { id: "creator-fit", score: 80, weight: 2 },
        { id: "content-fit", score: 70, weight: 1 }
      ]
    });

    expect(result.score).toBeCloseTo(83.3333, 4);
    expect(result.status).toBe("qualified");
    expect(result.hardGateFailed).toBe(false);
    expect(result.criteria).toHaveLength(3);
    expect(result.criteria[0]?.normalizedWeight).toBe(0.5);
    expect(result.criteria[0]?.weightedContribution).toBe(45);
    expect(result.criteria[1]?.weightedContribution).toBeCloseTo(26.6667, 4);
    expect(result.criteria[2]?.weightedContribution).toBeCloseTo(11.6667, 4);
  });

  it("rejects when a hard gate fails even with a high score", () => {
    const result = qualifyBrand({
      thresholds: {
        qualifiedMinScore: 80,
        reviewMinScore: 60
      },
      criteria: [
        {
          id: "economics",
          score: 95,
          weight: 3,
          hardGate: {
            passed: false,
            reason: "Target contribution margin is not feasible"
          }
        },
        { id: "creator-fit", score: 90, weight: 1 }
      ]
    });

    expect(result.score).toBeCloseTo(93.75, 2);
    expect(result.status).toBe("reject");
    expect(result.hardGateFailed).toBe(true);
    expect(result.hardGateFailures).toEqual([
      {
        criterionId: "economics",
        reason: "Target contribution margin is not feasible"
      }
    ]);
  });

  it("handles threshold boundaries deterministically", () => {
    const qualified = qualifyBrand({
      thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
      criteria: [{ id: "score", score: 80, weight: 1 }]
    });
    const review = qualifyBrand({
      thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
      criteria: [{ id: "score", score: 60, weight: 1 }]
    });
    const reject = qualifyBrand({
      thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
      criteria: [{ id: "score", score: 59.9999, weight: 1 }]
    });

    expect(qualified.status).toBe("qualified");
    expect(review.status).toBe("review");
    expect(reject.status).toBe("reject");

    expect(
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [
          { id: "a", score: 75, weight: 2 },
          { id: "b", score: 65, weight: 1 }
        ]
      })
    ).toEqual(
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [
          { id: "a", score: 75, weight: 2 },
          { id: "b", score: 65, weight: 1 }
        ]
      })
    );
  });

  it("rejects invalid criterion inputs", () => {
    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [{ id: "", score: 80, weight: 1 }]
      })
    ).toThrow();

    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [
          { id: "economics", score: 80, weight: 1 },
          { id: "economics", score: 70, weight: 1 }
        ]
      })
    ).toThrow();

    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [{ id: "economics", score: 101, weight: 1 }]
      })
    ).toThrow();

    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: [{ id: "economics", score: 80, weight: 0 }]
      })
    ).toThrow();
  });

  it("rejects invalid thresholds and empty criterion sets", () => {
    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 50, reviewMinScore: 60 },
        criteria: [{ id: "economics", score: 80, weight: 1 }]
      })
    ).toThrow();

    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 101, reviewMinScore: 60 },
        criteria: [{ id: "economics", score: 80, weight: 1 }]
      })
    ).toThrow();

    expect(() =>
      qualifyBrand({
        thresholds: { qualifiedMinScore: 80, reviewMinScore: 60 },
        criteria: []
      })
    ).toThrow();
  });
});
