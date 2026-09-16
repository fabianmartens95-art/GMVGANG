import { describe, expect, it } from "vitest";

import { buildBrandPortalReadModel } from "../src/brand-read-model.js";
import {
  loadBrandOverview,
  parseBrandOverview,
  renderBrandOverview,
  type BrandOverviewPort,
} from "../src/brand-workspace.js";

function model(organizationId = "brand-1") {
  return buildBrandPortalReadModel({
    organizationId,
    asOf: "2026-09-16T00:00:00.000Z",
    profitability: {
      grossMerchandiseValue: 10000,
      vatRate: 0.19,
      cogs: 2000,
      affiliateCommissionCost: 1000,
    },
    signals: {
      inventoryDaysOfCover: 8,
    },
    policy: {
      targetContributionMargin: 0.2,
      minimumInventoryDays: 14,
      rightsExpiryWarningDays: 14,
      maxDataAgeMinutes: 30,
    },
    dataStatus: {
      profitability: "ready",
      creatorOperations: "partial",
      rights: "unavailable",
      inventory: "ready",
      paidPerformance: "unavailable",
    },
  });
}

describe("parseBrandOverview", () => {
  it("accepts the canonical tenant-scoped read model", () => {
    const parsed = parseBrandOverview({ source: "production", model: model() });
    expect(parsed.source).toBe("production");
    expect(parsed.model.organizationId).toBe("brand-1");
    expect(parsed.model.profitability?.grossMerchandiseValue).toBe(10000);
  });

  it("rejects malformed status and action payloads", () => {
    expect(() =>
      parseBrandOverview({
        source: "production",
        model: {
          ...model(),
          dataStatus: { ...model().dataStatus, profitability: "trusted" },
        },
      }),
    ).toThrow("BRAND_OVERVIEW_STATUS_INVALID");

    expect(() =>
      parseBrandOverview({
        source: "production",
        model: {
          ...model(),
          nextBestActions: [{ id: "unsafe" }],
        },
      }),
    ).toThrow("BRAND_OVERVIEW_ACTIONS_INVALID");
  });
});

describe("loadBrandOverview", () => {
  it("fails closed when the response tenant differs from the authenticated tenant", async () => {
    const crossTenantPort: BrandOverviewPort = {
      async getOverview() {
        return { source: "production", model: model("brand-2") };
      },
    };

    await expect(loadBrandOverview("brand-1", crossTenantPort)).resolves.toBeNull();
  });

  it("returns the overview when tenant identity matches", async () => {
    const port: BrandOverviewPort = {
      async getOverview() {
        return { source: "production", model: model("brand-1") };
      },
    };

    await expect(loadBrandOverview("brand-1", port)).resolves.toMatchObject({
      source: "production",
      model: { organizationId: "brand-1" },
    });
  });
});

describe("renderBrandOverview", () => {
  it("renders an explicit unavailable state instead of inventing metrics", () => {
    const html = renderBrandOverview(null);
    expect(html).toContain("Brand-Daten noch nicht verbunden");
    expect(html).not.toContain("100.000");
  });

  it("renders profitability and actions from the read model", () => {
    const html = renderBrandOverview({ source: "production", model: model() });
    expect(html).toContain("PROFITABILITY CENTER");
    expect(html).toContain("NEXT BEST ACTION");
    expect(html).toContain("Creator-Aktivierung an Lagerbestand anpassen");
  });
});
