import { describe, expect, it } from "vitest";

import { buildCreatorEarningsReadModel } from "./index.js";

describe("buildCreatorEarningsReadModel", () => {
  it("aggregates recorded commission without claiming settlement or payout", () => {
    const model = buildCreatorEarningsReadModel([
      {
        campaignId: "campaign-a",
        campaignName: "Beauty Launch",
        gmVCents: 120000,
        orders: 42,
        recordedCommissionCents: 18000,
        updatedAt: "2026-09-18T00:10:00.000Z",
      },
      {
        campaignId: "campaign-b",
        campaignName: "Lifestyle Drop",
        gmVCents: 80000,
        orders: 21,
        recordedCommissionCents: 12000,
        updatedAt: "2026-09-18T00:30:00.000Z",
      },
    ], {
      generatedAt: "2026-09-18T00:40:00.000Z",
      currency: "eur",
    });

    expect(model.currency).toBe("EUR");
    expect(model.totals).toEqual({
      gmVCents: 200000,
      orders: 63,
      recordedCommissionCents: 30000,
    });
    expect(model.settlement).toEqual({
      status: "not_available",
      message: "Aufgezeichnete Provisionen sind noch kein bestätigter oder ausgezahlter Betrag.",
    });
    expect(model.updatedAt).toBe("2026-09-18T00:30:00.000Z");
  });

  it("sorts campaigns by recorded commission and then GMV", () => {
    const model = buildCreatorEarningsReadModel([
      {
        campaignId: "low",
        campaignName: "Low",
        gmVCents: 100000,
        orders: 10,
        recordedCommissionCents: 1000,
        updatedAt: null,
      },
      {
        campaignId: "high",
        campaignName: "High",
        gmVCents: 90000,
        orders: 8,
        recordedCommissionCents: 5000,
        updatedAt: null,
      },
    ], {
      generatedAt: "2026-09-18T00:40:00.000Z",
      currency: "EUR",
    });

    expect(model.campaigns.map((item) => item.campaignId)).toEqual(["high", "low"]);
  });

  it("fails closed on duplicate campaigns or invalid monetary values", () => {
    const duplicate = {
      campaignId: "same",
      campaignName: "Same",
      gmVCents: 100,
      orders: 1,
      recordedCommissionCents: 10,
      updatedAt: null,
    };

    expect(() => buildCreatorEarningsReadModel([duplicate, duplicate], {
      generatedAt: "2026-09-18T00:40:00.000Z",
      currency: "EUR",
    })).toThrow("CREATOR_EARNINGS_DUPLICATE_CAMPAIGN");

    expect(() => buildCreatorEarningsReadModel([{
      ...duplicate,
      campaignId: "negative",
      recordedCommissionCents: -1,
    }], {
      generatedAt: "2026-09-18T00:40:00.000Z",
      currency: "EUR",
    })).toThrow("CREATOR_EARNINGS_COMMISSION_INVALID");
  });

  it("requires explicit ISO-like currency code and valid timestamps", () => {
    expect(() => buildCreatorEarningsReadModel([], {
      generatedAt: "not-a-date",
      currency: "EUR",
    })).toThrow("CREATOR_EARNINGS_GENERATED_AT_INVALID");

    expect(() => buildCreatorEarningsReadModel([], {
      generatedAt: "2026-09-18T00:40:00.000Z",
      currency: "€",
    })).toThrow("CREATOR_EARNINGS_CURRENCY_INVALID");
  });
});
