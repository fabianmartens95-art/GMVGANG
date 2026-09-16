import { describe, expect, it } from "vitest";

import { buildBrandPortalReadModel } from "../src/brand-read-model.js";

const policy = {
  targetContributionMargin: 0.2,
  minimumInventoryDays: 10,
  rightsExpiryWarningDays: 14,
  maxDataAgeMinutes: 30,
  targetRoas: 3,
};

describe("buildBrandPortalReadModel", () => {
  it("combines profitability with operational signals into a tenant-scoped read model", () => {
    const model = buildBrandPortalReadModel({
      organizationId: "brand-org-1",
      asOf: "2026-09-16T00:00:00Z",
      profitability: {
        grossMerchandiseValue: 10000,
        vatRate: 0.19,
        cogs: 5000,
        paidMediaCost: 2500,
      },
      signals: {
        inventoryDaysOfCover: 5,
        pendingSampleApprovals: 4,
        sourceAgeMinutes: 10,
      },
      policy,
      dataStatus: {
        profitability: "ready",
        creatorOperations: "ready",
        rights: "unavailable",
        inventory: "ready",
        paidPerformance: "partial",
      },
    });

    expect(model.organizationId).toBe("brand-org-1");
    expect(model.profitability?.contribution).toBe(903.36);
    expect(model.performance).toBeNull();
    expect(model.dataStatus.affiliatePerformance).toBe("unavailable");
    expect(model.nextBestActions.map((action) => action.id)).toEqual([
      "inventory-below-minimum",
      "profitability-below-target",
      "sample-approvals-pending",
    ]);
    expect(model.readiness).toEqual({
      availableSections: 3,
      partialSections: 1,
      unavailableSections: 2,
    });
  });

  it("keeps profitability absent instead of inventing economics when source data is unavailable", () => {
    const model = buildBrandPortalReadModel({
      organizationId: "brand-org-2",
      asOf: "2026-09-16T00:00:00Z",
      signals: {
        stalledCreators: 2,
      },
      policy,
      dataStatus: {
        profitability: "unavailable",
        creatorOperations: "partial",
        rights: "unavailable",
        inventory: "unavailable",
        paidPerformance: "unavailable",
      },
    });

    expect(model.profitability).toBeNull();
    expect(model.performance).toBeNull();
    expect(model.nextBestActions.map((action) => action.id)).toEqual([
      "creator-activations-stalled",
    ]);
  });

  it("rejects an empty organization scope", () => {
    expect(() =>
      buildBrandPortalReadModel({
        organizationId: "   ",
        asOf: "2026-09-16T00:00:00Z",
        policy,
        dataStatus: {
          profitability: "unavailable",
          creatorOperations: "unavailable",
          rights: "unavailable",
          inventory: "unavailable",
          paidPerformance: "unavailable",
        },
      })
    ).toThrow("organizationId must not be empty");
  });
});
