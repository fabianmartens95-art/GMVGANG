import { describe, expect, it } from "vitest";
import {
  evaluateFullProfitabilityReadiness,
  requireFullProfitabilityInputs,
} from "./profitability-readiness.js";

const complete = {
  grossMerchandiseValue: 100_000,
  vatRate: 0.19,
  refundsGross: 8_000,
  discountsGross: 5_000,
  cogs: 25_000,
  fulfillmentCost: 5_000,
  affiliateCommissionCost: 15_000,
  paidMediaCost: 12_000,
  agencyFees: 5_000,
  paymentFees: 1_800,
  platformFees: 900,
  otherVariableCosts: 0,
};

describe("full profitability readiness", () => {
  it("is ready only when every profitability input is explicitly present", () => {
    const readiness = evaluateFullProfitabilityReadiness(complete);
    expect(readiness).toMatchObject({
      status: "ready",
      readyForFullProfitability: true,
      missing: [],
      explicitZeroInputs: ["otherVariableCosts"],
    });
  });

  it("does not silently interpret a missing cost as zero", () => {
    const { paidMediaCost: _removed, ...withoutPaidMedia } = complete;
    const readiness = evaluateFullProfitabilityReadiness(withoutPaidMedia);
    expect(readiness).toEqual({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["paidMediaCost"],
      explicitZeroInputs: ["otherVariableCosts"],
    });
    expect(() => requireFullProfitabilityInputs(withoutPaidMedia))
      .toThrow("PROFITABILITY_INPUTS_INCOMPLETE:paidMediaCost");
  });

  it("treats an explicit zero as known data, not missing data", () => {
    const readiness = evaluateFullProfitabilityReadiness({
      ...complete,
      cogs: 0,
      paidMediaCost: 0,
    });
    expect(readiness.readyForFullProfitability).toBe(true);
    expect(readiness.explicitZeroInputs).toEqual([
      "cogs",
      "paidMediaCost",
      "otherVariableCosts",
    ]);
  });

  it("rejects invalid rates, negative costs and impossible revenue adjustments", () => {
    expect(() => evaluateFullProfitabilityReadiness({ ...complete, vatRate: 1 }))
      .toThrow("PROFITABILITY_INPUT_INVALID:vatRate");
    expect(() => evaluateFullProfitabilityReadiness({ ...complete, cogs: -1 }))
      .toThrow("PROFITABILITY_INPUT_INVALID:cogs");
    expect(() => evaluateFullProfitabilityReadiness({
      ...complete,
      refundsGross: 80_000,
      discountsGross: 30_000,
    })).toThrow("PROFITABILITY_REVENUE_ADJUSTMENTS_EXCEED_GMV");
  });

  it("returns the exact complete input set for the downstream calculator", () => {
    expect(requireFullProfitabilityInputs(complete)).toEqual(complete);
  });
});
