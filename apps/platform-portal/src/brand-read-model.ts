import {
  calculateProfitabilitySnapshot,
  recommendNextBestActions,
  type BrandDecisionPolicy,
  type BrandDecisionSignals,
  type BrandNextBestAction,
  type ProfitabilitySnapshot,
  type ProfitabilitySnapshotInput,
} from "@gmvgang/brand-intelligence";

export type BrandPortalDataStatus = "ready" | "partial" | "unavailable";

export type BrandPortalReadModelInput = {
  organizationId: string;
  asOf: string;
  profitability?: ProfitabilitySnapshotInput;
  signals?: Omit<BrandDecisionSignals, "profitability">;
  policy: BrandDecisionPolicy;
  dataStatus: {
    profitability: BrandPortalDataStatus;
    creatorOperations: BrandPortalDataStatus;
    rights: BrandPortalDataStatus;
    inventory: BrandPortalDataStatus;
    paidPerformance: BrandPortalDataStatus;
  };
};

export type BrandPortalReadModel = {
  organizationId: string;
  asOf: string;
  profitability: ProfitabilitySnapshot | null;
  nextBestActions: BrandNextBestAction[];
  dataStatus: BrandPortalReadModelInput["dataStatus"];
  readiness: {
    availableSections: number;
    partialSections: number;
    unavailableSections: number;
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
  const statuses = Object.values(input.dataStatus);

  return {
    organizationId: input.organizationId,
    asOf: input.asOf,
    profitability,
    nextBestActions,
    dataStatus: input.dataStatus,
    readiness: {
      availableSections: statuses.filter((status) => status === "ready").length,
      partialSections: statuses.filter((status) => status === "partial").length,
      unavailableSections: statuses.filter((status) => status === "unavailable").length,
    },
  };
}
