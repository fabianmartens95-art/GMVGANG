import { describe, expect, it } from "vitest";

import {
  calculateProfitabilitySnapshot,
  recommendNextBestActions,
} from "./index.js";

describe("calculateProfitabilitySnapshot", () => {
  it("calculates realized revenue, contribution and contribution margin", () => {
    const result = calculateProfitabilitySnapshot({
      grossMerchandiseValue: 100000,
      vatRate: 0.19,
      refundsGross: 5000,
      discountsGross: 2000,
      cogs: 25000,
      fulfillmentCost: 4000,
      affiliateCommissionCost: 10000,
      paidMediaCost: 8000,
      agencyFees: 2000,
      paymentFees: 1000,
    });

    expect(result.realizedGrossRevenue).toBe(93000);
    expect(result.netRevenue).toBe(78151.26);
    expect(result.totalVariableCosts).toBe(50000);
    expect(result.contribution).toBe(28151.26);
    expect(result.contributionMargin).toBe(0.3602);
  });

  it("rejects revenue deductions that exceed GMV", () => {
    expect(() =>
      calculateProfitabilitySnapshot({
        grossMerchandiseValue: 100,
        vatRate: 0.19,
        refundsGross: 80,
        discountsGross: 30,
        cogs: 10,
      })
    ).toThrow("refundsGross + discountsGross must not exceed grossMerchandiseValue");
  });
});

describe("recommendNextBestActions", () => {
  const policy = {
    targetContributionMargin: 0.2,
    minimumInventoryDays: 10,
    rightsExpiryWarningDays: 14,
    maxDataAgeMinutes: 30,
    targetRoas: 3,
  };

  it("produces explainable, priority-sorted actions", () => {
    const actions = recommendNextBestActions(
      {
        profitability: { contribution: -500, contributionMargin: -0.05 },
        inventoryDaysOfCover: 4,
        expiringRights: { count: 3, nearestExpiryDays: 6 },
        reportedRoas: 2.1,
        pendingSampleApprovals: 7,
        stalledCreators: 2,
        sourceAgeMinutes: 45,
      },
      policy
    );

    expect(actions.map((action) => action.id)).toEqual([
      "inventory-below-minimum",
      "profitability-below-target",
      "creative-rights-expiring",
      "data-source-stale",
      "roas-below-target",
      "creator-activations-stalled",
      "sample-approvals-pending",
    ]);

    expect(actions[1]?.evidence).toMatchObject({
      contribution: -500,
      targetContributionMargin: 0.2,
    });
  });

  it("returns no action when all configured guardrails are healthy", () => {
    const actions = recommendNextBestActions(
      {
        profitability: { contribution: 5000, contributionMargin: 0.3 },
        inventoryDaysOfCover: 25,
        expiringRights: { count: 0, nearestExpiryDays: 90 },
        reportedRoas: 4.2,
        pendingSampleApprovals: 0,
        stalledCreators: 0,
        sourceAgeMinutes: 5,
      },
      policy
    );

    expect(actions).toEqual([]);
  });
});
