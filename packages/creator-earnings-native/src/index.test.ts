import { describe, expect, it } from "vitest";
import { buildNativeCreatorEarnings } from "./index.js";

const row = {
  campaign_id: "campaign-1",
  creator_profile_id: "creator-1",
  gmv_cents: 8000,
  orders: 4,
  commission_cents: 1200,
  performance_updated_at: "2026-09-18T05:20:00.000Z",
  campaigns: {
    id: "campaign-1",
    name: "Launch",
  },
};

describe("native Creator Earnings adapter", () => {
  it("maps only the authenticated Creator's native assignment rows", () => {
    const model = buildNativeCreatorEarnings({
      creatorProfileId: "creator-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      rows: [row],
    });

    expect(model.totals).toEqual({
      gmVCents: 8000,
      orders: 4,
      recordedCommissionCents: 1200,
    });
    expect(model.campaigns[0]?.campaignName).toBe("Launch");
    expect(model.updatedAt).toBe("2026-09-18T05:20:00.000Z");
    expect(model.settlement.status).toBe("not_available");
    expect(model.settlement.message).toContain("kein bestätigter oder ausgezahlter Betrag");
  });

  it("fails closed on a cross-Creator row", () => {
    expect(() => buildNativeCreatorEarnings({
      creatorProfileId: "creator-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      rows: [{ ...row, creator_profile_id: "creator-2" }],
    })).toThrow("CREATOR_NATIVE_EARNINGS_OWNERSHIP_MISMATCH");
  });

  it("rejects malformed money and Campaign joins", () => {
    expect(() => buildNativeCreatorEarnings({
      creatorProfileId: "creator-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      rows: [{ ...row, commission_cents: -1 }],
    })).toThrow("CREATOR_NATIVE_EARNINGS_COMMISSION_INVALID");

    expect(() => buildNativeCreatorEarnings({
      creatorProfileId: "creator-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      rows: [{ ...row, campaigns: { id: "campaign-2", name: "Wrong" } }],
    })).toThrow("CREATOR_NATIVE_EARNINGS_CAMPAIGN_JOIN_INVALID");
  });

  it("rejects duplicate Campaign rows through the canonical Earnings core", () => {
    expect(() => buildNativeCreatorEarnings({
      creatorProfileId: "creator-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      rows: [row, row],
    })).toThrow("CREATOR_EARNINGS_DUPLICATE_CAMPAIGN");
  });
});
