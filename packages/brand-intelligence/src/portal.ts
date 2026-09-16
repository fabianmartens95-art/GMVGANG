import type { AffiliatePerformanceReadModel } from "@gmvgang/affiliate-performance";
import type { BrandNextBestAction, ProfitabilitySnapshot } from "./index.js";

export type BrandPortalDataStatus = "ready" | "partial" | "unavailable";

export type BrandPortalDataStatusMap = {
  profitability: BrandPortalDataStatus;
  creatorOperations: BrandPortalDataStatus;
  rights: BrandPortalDataStatus;
  inventory: BrandPortalDataStatus;
  paidPerformance: BrandPortalDataStatus;
  affiliatePerformance: BrandPortalDataStatus;
};

export type BrandPortalReadModel = {
  organizationId: string;
  asOf: string;
  profitability: ProfitabilitySnapshot | null;
  performance: AffiliatePerformanceReadModel | null;
  nextBestActions: BrandNextBestAction[];
  dataStatus: BrandPortalDataStatusMap;
  readiness: {
    availableSections: number;
    partialSections: number;
    unavailableSections: number;
  };
};

export function unavailableBrandPortalReadModel(organizationId: string, asOf: string): BrandPortalReadModel {
  const cleanOrganizationId = organizationId.trim();
  if (!cleanOrganizationId) throw new Error("BRAND_PORTAL_ORGANIZATION_REQUIRED");
  if (!Number.isFinite(Date.parse(asOf))) throw new Error("BRAND_PORTAL_AS_OF_INVALID");

  const dataStatus: BrandPortalDataStatusMap = {
    profitability: "unavailable",
    creatorOperations: "unavailable",
    rights: "unavailable",
    inventory: "unavailable",
    paidPerformance: "unavailable",
    affiliatePerformance: "unavailable",
  };

  return {
    organizationId: cleanOrganizationId,
    asOf,
    profitability: null,
    performance: null,
    nextBestActions: [],
    dataStatus,
    readiness: {
      availableSections: 0,
      partialSections: 0,
      unavailableSections: Object.keys(dataStatus).length,
    },
  };
}
