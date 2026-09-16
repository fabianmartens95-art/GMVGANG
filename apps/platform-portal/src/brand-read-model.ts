import {
  calculateProfitabilitySnapshot,
  recommendNextBestActions,
  type BrandDecisionPolicy,
  type BrandDecisionSignals,
  type ProfitabilitySnapshotInput,
} from "@gmvgang/brand-intelligence";
import type {
  BrandPortalDataStatus,
  BrandPortalDataStatusMap,
  BrandPortalReadModel,
} from "@gmvgang/brand-intelligence/portal";

export type { BrandPortalDataStatus, BrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";

export type BrandPortalReadModelInput = {
  organizationId: string;
  asOf: string;
  profitability?: ProfitabilitySnapshotInput;
  performance?: NonNullable<BrandPortalReadModel["performance"]>;
  signals?: Omit<BrandDecisionSignals, "profitability">;
  policy: BrandDecisionPolicy;
  dataStatus: Omit<BrandPortalDataStatusMap, "affiliatePerformance"> & {
    affiliatePerformance?: BrandPortalDataStatus;
  };
};

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

export function buildBrandPortalReadModel(
  input: BrandPortalReadModelInput
): BrandPortalReadModel {
  assertNonEmpty(input.organizationId, "organizationId");
  assertNonEmpty(input.asOf, "asOf");

  if (input.performance && input.performance.scope.organizationId !== input.organizationId) {
    throw new Error("BRAND_PERFORMANCE_ORGANIZATION_MISMATCH");
  }

  const profitability = input.profitability
    ? calculateProfitabilitySnapshot(input.profitability)
    : null;

  const signals: BrandDecisionSignals = {
    ...(input.signals ?? {}),
    ...(profitability
      ? {
          profitability: {
            contribution: profitability.contribution,
            contributionMargin: profitability.contributionMargin,
          },
        }
      : {}),
  };

  const nextBestActions = recommendNextBestActions(signals, input.policy);
  const dataStatus: BrandPortalDataStatusMap = {
    ...input.dataStatus,
    affiliatePerformance: input.dataStatus.affiliatePerformance ?? "unavailable",
  };
  const statuses = Object.values(dataStatus);

  return {
    organizationId: input.organizationId,
    asOf: input.asOf,
    profitability,
    performance: input.performance ?? null,
    nextBestActions,
    dataStatus,
    readiness: {
      availableSections: statuses.filter((status) => status === "ready").length,
      partialSections: statuses.filter((status) => status === "partial").length,
      unavailableSections: statuses.filter((status) => status === "unavailable").length,
    },
  };
}
