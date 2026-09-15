export type ProfitabilitySnapshotInput = {
  grossMerchandiseValue: number;
  vatRate: number;
  refundsGross?: number;
  discountsGross?: number;
  cogs: number;
  fulfillmentCost?: number;
  affiliateCommissionCost?: number;
  paidMediaCost?: number;
  agencyFees?: number;
  paymentFees?: number;
  platformFees?: number;
  otherVariableCosts?: number;
};

export type ProfitabilitySnapshot = {
  grossMerchandiseValue: number;
  realizedGrossRevenue: number;
  netRevenue: number;
  totalVariableCosts: number;
  contribution: number;
  contributionMargin: number;
  costBreakdown: {
    cogs: number;
    fulfillmentCost: number;
    affiliateCommissionCost: number;
    paidMediaCost: number;
    agencyFees: number;
    paymentFees: number;
    platformFees: number;
    otherVariableCosts: number;
  };
};

export type BrandDecisionPolicy = {
  targetContributionMargin: number;
  minimumInventoryDays: number;
  rightsExpiryWarningDays: number;
  maxDataAgeMinutes: number;
  targetRoas?: number;
};

export type BrandDecisionSignals = {
  profitability?: Pick<ProfitabilitySnapshot, "contribution" | "contributionMargin">;
  inventoryDaysOfCover?: number;
  expiringRights?: {
    count: number;
    nearestExpiryDays: number;
  };
  reportedRoas?: number;
  pendingSampleApprovals?: number;
  stalledCreators?: number;
  sourceAgeMinutes?: number;
};

export type BrandActionPriority = "critical" | "high" | "medium";

export type BrandNextBestAction = {
  id: string;
  priority: BrandActionPriority;
  category:
    | "profitability"
    | "inventory"
    | "rights"
    | "performance"
    | "creator-operations"
    | "data-quality";
  title: string;
  reason: string;
  suggestedAction: string;
  evidence: Record<string, number>;
};

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite, non-negative number`);
  }
}

function assertRate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${field} must be >= 0 and < 1`);
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function calculateProfitabilitySnapshot(
  input: ProfitabilitySnapshotInput
): ProfitabilitySnapshot {
  assertFiniteNonNegative(input.grossMerchandiseValue, "grossMerchandiseValue");
  assertRate(input.vatRate, "vatRate");
  assertFiniteNonNegative(input.cogs, "cogs");

  const refundsGross = input.refundsGross ?? 0;
  const discountsGross = input.discountsGross ?? 0;
  const fulfillmentCost = input.fulfillmentCost ?? 0;
  const affiliateCommissionCost = input.affiliateCommissionCost ?? 0;
  const paidMediaCost = input.paidMediaCost ?? 0;
  const agencyFees = input.agencyFees ?? 0;
  const paymentFees = input.paymentFees ?? 0;
  const platformFees = input.platformFees ?? 0;
  const otherVariableCosts = input.otherVariableCosts ?? 0;

  const optionalCosts = {
    refundsGross,
    discountsGross,
    fulfillmentCost,
    affiliateCommissionCost,
    paidMediaCost,
    agencyFees,
    paymentFees,
    platformFees,
    otherVariableCosts,
  };

  for (const [field, value] of Object.entries(optionalCosts)) {
    assertFiniteNonNegative(value, field);
  }

  if (refundsGross + discountsGross > input.grossMerchandiseValue) {
    throw new Error("refundsGross + discountsGross must not exceed grossMerchandiseValue");
  }

  const realizedGrossRevenue =
    input.grossMerchandiseValue - refundsGross - discountsGross;
  const netRevenue = realizedGrossRevenue / (1 + input.vatRate);

  const costBreakdown = {
    cogs: input.cogs,
    fulfillmentCost,
    affiliateCommissionCost,
    paidMediaCost,
    agencyFees,
    paymentFees,
    platformFees,
    otherVariableCosts,
  };

  const totalVariableCosts = Object.values(costBreakdown).reduce(
    (sum, value) => sum + value,
    0
  );
  const contribution = netRevenue - totalVariableCosts;
  const contributionMargin = netRevenue > 0 ? contribution / netRevenue : 0;

  return {
    grossMerchandiseValue: roundMoney(input.grossMerchandiseValue),
    realizedGrossRevenue: roundMoney(realizedGrossRevenue),
    netRevenue: roundMoney(netRevenue),
    totalVariableCosts: roundMoney(totalVariableCosts),
    contribution: roundMoney(contribution),
    contributionMargin: roundRatio(contributionMargin),
    costBreakdown: Object.fromEntries(
      Object.entries(costBreakdown).map(([key, value]) => [key, roundMoney(value)])
    ) as ProfitabilitySnapshot["costBreakdown"],
  };
}

function priorityRank(priority: BrandActionPriority): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

export function recommendNextBestActions(
  signals: BrandDecisionSignals,
  policy: BrandDecisionPolicy
): BrandNextBestAction[] {
  assertRate(policy.targetContributionMargin, "targetContributionMargin");
  assertFiniteNonNegative(policy.minimumInventoryDays, "minimumInventoryDays");
  assertFiniteNonNegative(policy.rightsExpiryWarningDays, "rightsExpiryWarningDays");
  assertFiniteNonNegative(policy.maxDataAgeMinutes, "maxDataAgeMinutes");

  if (policy.targetRoas !== undefined) {
    assertFiniteNonNegative(policy.targetRoas, "targetRoas");
  }

  const actions: BrandNextBestAction[] = [];

  if (
    signals.profitability &&
    signals.profitability.contributionMargin < policy.targetContributionMargin
  ) {
    actions.push({
      id: "profitability-below-target",
      priority: signals.profitability.contribution < 0 ? "critical" : "high",
      category: "profitability",
      title: "Profitabilität vor weiterer Skalierung prüfen",
      reason: "Die aktuelle Contribution Margin liegt unter dem definierten Zielwert.",
      suggestedAction:
        "Kosten-, Provisions- und Paid-Media-Treiber prüfen und Skalierung erst nach einem belastbaren Economics-Review fortsetzen.",
      evidence: {
        contribution: signals.profitability.contribution,
        contributionMargin: signals.profitability.contributionMargin,
        targetContributionMargin: policy.targetContributionMargin,
      },
    });
  }

  if (
    signals.inventoryDaysOfCover !== undefined &&
    signals.inventoryDaysOfCover < policy.minimumInventoryDays
  ) {
    assertFiniteNonNegative(signals.inventoryDaysOfCover, "inventoryDaysOfCover");
    actions.push({
      id: "inventory-below-minimum",
      priority: "critical",
      category: "inventory",
      title: "Creator-Aktivierung an Lagerbestand anpassen",
      reason: "Der Lagerbestand liegt unter dem definierten Mindestbestand in Verkaufstagen.",
      suggestedAction:
        "Outreach, Samples oder Paid Scaling für das betroffene Produkt begrenzen, bis Bestand und Nachschub geklärt sind.",
      evidence: {
        inventoryDaysOfCover: signals.inventoryDaysOfCover,
        minimumInventoryDays: policy.minimumInventoryDays,
      },
    });
  }

  if (signals.expiringRights) {
    assertFiniteNonNegative(signals.expiringRights.count, "expiringRights.count");
    assertFiniteNonNegative(
      signals.expiringRights.nearestExpiryDays,
      "expiringRights.nearestExpiryDays"
    );

    if (
      signals.expiringRights.count > 0 &&
      signals.expiringRights.nearestExpiryDays <= policy.rightsExpiryWarningDays
    ) {
      actions.push({
        id: "creative-rights-expiring",
        priority: "high",
        category: "rights",
        title: "Auslaufende Content-Rechte bearbeiten",
        reason: "Mindestens ein aktives Nutzungsrecht erreicht das definierte Warnfenster.",
        suggestedAction:
          "Verlängerung, Ersatz-Creative oder Abschaltung der betroffenen Nutzung vor Ablauf einplanen.",
        evidence: {
          expiringRightsCount: signals.expiringRights.count,
          nearestExpiryDays: signals.expiringRights.nearestExpiryDays,
          rightsExpiryWarningDays: policy.rightsExpiryWarningDays,
        },
      });
    }
  }

  if (
    signals.reportedRoas !== undefined &&
    policy.targetRoas !== undefined &&
    signals.reportedRoas < policy.targetRoas
  ) {
    assertFiniteNonNegative(signals.reportedRoas, "reportedRoas");
    actions.push({
      id: "roas-below-target",
      priority: "high",
      category: "performance",
      title: "Paid Performance gegen Ziel-ROAS prüfen",
      reason: "Der gemeldete ROAS liegt unter dem konfigurierten Zielwert.",
      suggestedAction:
        "Creative-, Produkt- und Budgettreiber prüfen und Budget nicht allein auf Basis von reported GMV erhöhen.",
      evidence: {
        reportedRoas: signals.reportedRoas,
        targetRoas: policy.targetRoas,
      },
    });
  }

  if ((signals.pendingSampleApprovals ?? 0) > 0) {
    assertFiniteNonNegative(signals.pendingSampleApprovals ?? 0, "pendingSampleApprovals");
    actions.push({
      id: "sample-approvals-pending",
      priority: "medium",
      category: "creator-operations",
      title: "Offene Sample-Freigaben bearbeiten",
      reason: "Creator-Aktivierungen warten auf eine Brand-Freigabe.",
      suggestedAction: "Offene Sample-Anfragen prüfen und qualifizierte Anfragen freigeben oder ablehnen.",
      evidence: {
        pendingSampleApprovals: signals.pendingSampleApprovals ?? 0,
      },
    });
  }

  if ((signals.stalledCreators ?? 0) > 0) {
    assertFiniteNonNegative(signals.stalledCreators ?? 0, "stalledCreators");
    actions.push({
      id: "creator-activations-stalled",
      priority: "medium",
      category: "creator-operations",
      title: "Blockierte Creator-Aktivierungen prüfen",
      reason: "Mindestens ein Creator ist im operativen Aktivierungsprozess blockiert.",
      suggestedAction: "Blocker nach Sample, Briefing, Content, Freigabe oder Eligibility auflösen.",
      evidence: {
        stalledCreators: signals.stalledCreators ?? 0,
      },
    });
  }

  if (
    signals.sourceAgeMinutes !== undefined &&
    signals.sourceAgeMinutes > policy.maxDataAgeMinutes
  ) {
    assertFiniteNonNegative(signals.sourceAgeMinutes, "sourceAgeMinutes");
    actions.push({
      id: "data-source-stale",
      priority: "high",
      category: "data-quality",
      title: "Datenaktualität wiederherstellen",
      reason: "Die Entscheidungsdaten sind älter als das konfigurierte Freshness-Limit.",
      suggestedAction:
        "Sync-/Ingestion-Status prüfen und wirtschaftliche Entscheidungen erst nach aktuellem Datenstand treffen.",
      evidence: {
        sourceAgeMinutes: signals.sourceAgeMinutes,
        maxDataAgeMinutes: policy.maxDataAgeMinutes,
      },
    });
  }

  return actions.sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    return priorityDelta !== 0 ? priorityDelta : a.id.localeCompare(b.id);
  });
}
