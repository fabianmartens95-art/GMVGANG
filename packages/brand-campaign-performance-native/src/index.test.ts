import { describe, expect, it } from "vitest";
import { buildNativeBrandCampaignPerformance } from "./index.js";

const row = {
  campaign_id: "campaign-1",
  creator_profile_id: "creator-1",
  gmv_cents: 12500,
  orders: 5,
  commission_cents: 1875,
  content_status: "posted",
  performance_updated_at: "2026-09-18T05:30:00.000Z",
  campaigns: {
    id: "campaign-1",
    organization_id: "brand-1",
    name: "Launch",
  },
};

describe("native Brand Campaign performance adapter", () => {
  it("maps organization-bound native rows into the canonical performance core", () => {
    const model = buildNativeBrandCampaignPerformance({
      organizationId: "brand-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      hasAnalyticsBasic: true,
      rows: [row],
    });

    expect(model.totals).toMatchObject({
      gmvCents: 12500,
      orders: 5,
      recordedCommissionCents: 1875,
      assignedCreators: 1,
      postedCreators: 1,
    });
    expect(model.campaigns[0]?.campaignName).toBe("Launch");
    expect(model.economicsNotice).toContain("keine vollständige Profitabilitätsberechnung");
  });

  it("fails closed when analytics.basic is not granted", () => {
    expect(() => buildNativeBrandCampaignPerformance({
      organizationId: "brand-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      hasAnalyticsBasic: false,
      rows: [row],
    })).toThrow("BRAND_ANALYTICS_BASIC_REQUIRED");
  });

  it("fails closed if a joined Campaign belongs to another organization", () => {
    expect(() => buildNativeBrandCampaignPerformance({
      organizationId: "brand-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      hasAnalyticsBasic: true,
      rows: [{
        ...row,
        campaigns: { ...row.campaigns, organization_id: "brand-2" },
      }],
    })).toThrow("BRAND_NATIVE_PERFORMANCE_TENANT_MISMATCH");
  });

  it("rejects malformed native metrics and duplicate assignments through the canonical core", () => {
    expect(() => buildNativeBrandCampaignPerformance({
      organizationId: "brand-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      hasAnalyticsBasic: true,
      rows: [{ ...row, gmv_cents: -1 }],
    })).toThrow("BRAND_NATIVE_PERFORMANCE_GMV_INVALID");

    expect(() => buildNativeBrandCampaignPerformance({
      organizationId: "brand-1",
      generatedAt: "2026-09-18T06:00:00.000Z",
      currency: "EUR",
      hasAnalyticsBasic: true,
      rows: [row, row],
    })).toThrow("BRAND_PERFORMANCE_DUPLICATE_ASSIGNMENT");
  });
});
