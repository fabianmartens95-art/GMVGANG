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
  });
});
