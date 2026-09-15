import { describe, expect, it } from "vitest";
import { generatePilotPlan } from "./index";

const baseInput = {
  qualification: {
    score: 86,
    status: "qualified" as const,
    hardGateFailed: false
  },
  economics: {
    scenarioId: "creator-15-paid-20",
    viable: true,
    netRevenuePerOrder: 100,
    paidMediaCostPerOrder: 20,
    contributionAfterMarketingPerOrder: 23,
    contributionMarginAfterMarketing: 0.23,
    breakEvenRoas: 2.3256,
    targetRoas: 4.3478
  },
  targets: {
    targetOrders: 100,
    creatorCount: 10,
    durationDays: 14
  },
  guardrails: {
    maxPaidMediaBudget: 2500,
    minContributionMargin: 0.2,
    minRoas: 4
  }
};

describe("generatePilotPlan", () => {
  it("generates a ready pilot with transparent forecasts", () => {
    const result = generatePilotPlan(baseInput);

    expect(result.readiness).toBe("ready");
    expect(result.forecastNetRevenue).toBe(10000);
    expect(result.forecastPaidMediaSpend).toBe(2000);
    expect(result.forecastContributionAfterMarketing).toBe(2300);
    expect(result.projectedRoas).toBe(5);
    expect(result.budgetWithinGuardrail).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("returns review when qualification or an operational check requires review", () => {
    const result = generatePilotPlan({
      ...baseInput,
      qualification: {
        score: 68,
        status: "review"
      },
      operationalChecks: [
        {
          id: "sample-readiness",
          label: "Sample readiness",
          passed: false,
          severity: "review",
          reason: "Sample logistics still need confirmation."
        }
      ]
    });

    expect(result.readiness).toBe("review");
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "qualification_review",
      "operational_check:sample-readiness"
    ]);
  });

  it("blocks a pilot when economics are not viable", () => {
    const result = generatePilotPlan({
      ...baseInput,
      economics: {
        ...baseInput.economics,
        viable: false
      }
    });

    expect(result.readiness).toBe("blocked");
    expect(result.reasons).toContainEqual({
      code: "economics_not_viable",
      severity: "block",
      message: "Selected economics scenario is not viable."
    });
  });

  it("blocks a pilot when forecast spend exceeds the supplied budget guardrail", () => {
    const result = generatePilotPlan({
      ...baseInput,
      guardrails: {
        ...baseInput.guardrails,
        maxPaidMediaBudget: 1500
      }
    });

    expect(result.forecastPaidMediaSpend).toBe(2000);
    expect(result.budgetWithinGuardrail).toBe(false);
    expect(result.readiness).toBe("blocked");
    expect(result.reasons.some((reason) => reason.code === "paid_media_budget_exceeded")).toBe(true);
  });

  it("blocks on qualification hard gates and caller-provided economic guardrails", () => {
    const result = generatePilotPlan({
      ...baseInput,
      qualification: {
        score: 95,
        status: "qualified",
        hardGateFailed: true
      },
      guardrails: {
        maxPaidMediaBudget: 2500,
        minContributionMargin: 0.25,
        minRoas: 6
      }
    });

    expect(result.readiness).toBe("blocked");
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "qualification_hard_gate_failed",
      "contribution_margin_below_guardrail",
      "roas_below_guardrail"
    ]);
  });

  it("supports zero paid-media spend without inventing ROAS", () => {
    const result = generatePilotPlan({
      ...baseInput,
      economics: {
        ...baseInput.economics,
        paidMediaCostPerOrder: 0,
        contributionAfterMarketingPerOrder: 43,
        contributionMarginAfterMarketing: 0.43
      },
      guardrails: {
        maxPaidMediaBudget: 0,
        minContributionMargin: 0.2,
        minRoas: 4
      }
    });

    expect(result.projectedRoas).toBeNull();
    expect(result.forecastPaidMediaSpend).toBe(0);
    expect(result.readiness).toBe("ready");
  });

  it("rejects invalid and duplicate inputs", () => {
    expect(() =>
      generatePilotPlan({
        ...baseInput,
        targets: { ...baseInput.targets, targetOrders: 0 }
      })
    ).toThrow();

    expect(() =>
      generatePilotPlan({
        ...baseInput,
        qualification: { ...baseInput.qualification, score: 101 }
      })
    ).toThrow();

    expect(() =>
      generatePilotPlan({
        ...baseInput,
        operationalChecks: [
          { id: "legal", passed: true, severity: "block" },
          { id: "legal", passed: true, severity: "review" }
        ]
      })
    ).toThrow();
  });
});
