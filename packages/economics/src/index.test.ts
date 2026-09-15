import { describe, expect, it } from "vitest";
import { calculateProductEconomics } from "./index";

describe("calculateProductEconomics", () => {
  it("calculates a viable pilot economics case", () => {
    const result = calculateProductEconomics({
      sellingPriceGross: 119,
      vatRate: 0.19,
      cogs: 30,
      fulfillmentCost: 6,
      paymentCost: 2,
      returnsReserve: 4,
      affiliateCommissionRate: 0.15,
      paidMediaCostPerOrder: 20
    });

    expect(result.netRevenue).toBe(100);
    expect(result.affiliateCommissionCost).toBe(15);
    expect(result.contributionBeforeMarketing).toBe(43);
    expect(result.maximumMarketingCostPerOrder).toBe(43);
    expect(result.breakEvenRoas).toBeCloseTo(2.3256, 4);
    expect(result.contributionAfterMarketing).toBe(23);
    expect(result.contributionMarginAfterMarketing).toBe(0.23);
    expect(result.targetContributionMargin).toBeNull();
    expect(result.targetContributionAmount).toBeNull();
    expect(result.maximumMarketingCostAtTargetMargin).toBeNull();
    expect(result.targetRoas).toBeNull();
    expect(result.targetMarginFeasibleBeforeMarketing).toBeNull();
  });

  it("calculates a viable target contribution-margin guardrail", () => {
    const result = calculateProductEconomics({
      sellingPriceGross: 119,
      vatRate: 0.19,
      cogs: 30,
      fulfillmentCost: 6,
      paymentCost: 2,
      returnsReserve: 4,
      affiliateCommissionRate: 0.15,
      targetContributionMargin: 0.2
    });

    expect(result.targetContributionMargin).toBe(0.2);
    expect(result.targetContributionAmount).toBe(20);
    expect(result.maximumMarketingCostAtTargetMargin).toBe(23);
    expect(result.targetRoas).toBeCloseTo(4.3478, 4);
    expect(result.targetMarginFeasibleBeforeMarketing).toBe(true);
  });

  it("marks an impossible target margin as infeasible", () => {
    const result = calculateProductEconomics({
      sellingPriceGross: 119,
      vatRate: 0.19,
      cogs: 30,
      fulfillmentCost: 6,
      paymentCost: 2,
      returnsReserve: 4,
      affiliateCommissionRate: 0.15,
      targetContributionMargin: 0.5
    });

    expect(result.targetContributionAmount).toBe(50);
    expect(result.maximumMarketingCostAtTargetMargin).toBe(0);
    expect(result.targetRoas).toBeNull();
    expect(result.targetMarginFeasibleBeforeMarketing).toBe(false);
  });

  it("handles a zero-spend boundary target", () => {
    const result = calculateProductEconomics({
      sellingPriceGross: 119,
      vatRate: 0.19,
      cogs: 30,
      fulfillmentCost: 6,
      paymentCost: 2,
      returnsReserve: 4,
      affiliateCommissionRate: 0.15,
      targetContributionMargin: 0.43
    });

    expect(result.targetContributionAmount).toBe(43);
    expect(result.maximumMarketingCostAtTargetMargin).toBe(0);
    expect(result.targetRoas).toBeNull();
    expect(result.targetMarginFeasibleBeforeMarketing).toBe(true);
  });

  it("returns no break-even ROAS when unit economics are already negative", () => {
    const result = calculateProductEconomics({
      sellingPriceGross: 59.5,
      vatRate: 0.19,
      cogs: 45,
      fulfillmentCost: 7
    });

    expect(result.netRevenue).toBe(50);
    expect(result.contributionBeforeMarketing).toBe(-2);
    expect(result.maximumMarketingCostPerOrder).toBe(0);
    expect(result.breakEvenRoas).toBeNull();
  });

  it("rejects invalid rates", () => {
    expect(() =>
      calculateProductEconomics({
        sellingPriceGross: 100,
        vatRate: 1,
        cogs: 20
      })
    ).toThrow();

    expect(() =>
      calculateProductEconomics({
        sellingPriceGross: 100,
        vatRate: 0.19,
        cogs: 20,
        targetContributionMargin: 1
      })
    ).toThrow();
  });
});
