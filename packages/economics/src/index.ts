export type ProductEconomicsInput = {
  sellingPriceGross: number;
  vatRate: number;
  cogs: number;
  fulfillmentCost?: number;
  paymentCost?: number;
  returnsReserve?: number;
  affiliateCommissionRate?: number;
  paidMediaCostPerOrder?: number;
  targetContributionMargin?: number;
};

export type ProductEconomicsResult = {
  netRevenue: number;
  affiliateCommissionCost: number;
  contributionBeforeMarketing: number;
  maximumMarketingCostPerOrder: number;
  breakEvenRoas: number | null;
  paidMediaCostPerOrder: number;
  contributionAfterMarketing: number;
  contributionMarginAfterMarketing: number;
  targetContributionMargin: number | null;
  targetContributionAmount: number | null;
  maximumMarketingCostAtTargetMargin: number | null;
  targetRoas: number | null;
  targetMarginFeasibleBeforeMarketing: boolean | null;
};

export type PilotScenarioInput = {
  id: string;
  label?: string;
  economics: ProductEconomicsInput;
};

export type PilotScenarioComparison = {
  id: string;
  label: string | null;
  rank: number;
  viable: boolean;
  meetsTargetContributionMargin: boolean | null;
  contributionAfterMarketing: number;
  contributionMarginAfterMarketing: number;
  breakEvenRoas: number | null;
  targetRoas: number | null;
  economics: ProductEconomicsResult;
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

function assertScenarioId(value: string): void {
  if (value.trim().length === 0) {
    throw new Error("scenario id must not be empty");
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function calculateProductEconomics(
  input: ProductEconomicsInput
): ProductEconomicsResult {
  assertFiniteNonNegative(input.sellingPriceGross, "sellingPriceGross");
  assertRate(input.vatRate, "vatRate");
  assertFiniteNonNegative(input.cogs, "cogs");

  const fulfillmentCost = input.fulfillmentCost ?? 0;
  const paymentCost = input.paymentCost ?? 0;
  const returnsReserve = input.returnsReserve ?? 0;
  const affiliateCommissionRate = input.affiliateCommissionRate ?? 0;
  const paidMediaCostPerOrder = input.paidMediaCostPerOrder ?? 0;
  const targetContributionMargin = input.targetContributionMargin ?? null;

  assertFiniteNonNegative(fulfillmentCost, "fulfillmentCost");
  assertFiniteNonNegative(paymentCost, "paymentCost");
  assertFiniteNonNegative(returnsReserve, "returnsReserve");
  assertRate(affiliateCommissionRate, "affiliateCommissionRate");
  assertFiniteNonNegative(paidMediaCostPerOrder, "paidMediaCostPerOrder");

  if (targetContributionMargin !== null) {
    assertRate(targetContributionMargin, "targetContributionMargin");
  }

  const netRevenue = input.sellingPriceGross / (1 + input.vatRate);
  const affiliateCommissionCost = netRevenue * affiliateCommissionRate;

  const contributionBeforeMarketing =
    netRevenue -
    input.cogs -
    fulfillmentCost -
    paymentCost -
    returnsReserve -
    affiliateCommissionCost;

  const maximumMarketingCostPerOrder = Math.max(
    contributionBeforeMarketing,
    0
  );

  const breakEvenRoas =
    maximumMarketingCostPerOrder > 0
      ? netRevenue / maximumMarketingCostPerOrder
      : null;

  const contributionAfterMarketing =
    contributionBeforeMarketing - paidMediaCostPerOrder;

  const contributionMarginAfterMarketing =
    netRevenue > 0 ? contributionAfterMarketing / netRevenue : 0;

  const targetContributionAmount =
    targetContributionMargin === null
      ? null
      : netRevenue * targetContributionMargin;

  const targetMarginFeasibleBeforeMarketing =
    targetContributionAmount === null
      ? null
      : contributionBeforeMarketing >= targetContributionAmount;

  const maximumMarketingCostAtTargetMargin =
    targetContributionAmount === null
      ? null
      : Math.max(contributionBeforeMarketing - targetContributionAmount, 0);

  const targetRoas =
    maximumMarketingCostAtTargetMargin !== null &&
    maximumMarketingCostAtTargetMargin > 0
      ? netRevenue / maximumMarketingCostAtTargetMargin
      : null;

  return {
    netRevenue: roundMoney(netRevenue),
    affiliateCommissionCost: roundMoney(affiliateCommissionCost),
    contributionBeforeMarketing: roundMoney(contributionBeforeMarketing),
    maximumMarketingCostPerOrder: roundMoney(maximumMarketingCostPerOrder),
    breakEvenRoas:
      breakEvenRoas === null ? null : roundRatio(breakEvenRoas),
    paidMediaCostPerOrder: roundMoney(paidMediaCostPerOrder),
    contributionAfterMarketing: roundMoney(contributionAfterMarketing),
    contributionMarginAfterMarketing: roundRatio(
      contributionMarginAfterMarketing
    ),
    targetContributionMargin:
      targetContributionMargin === null
        ? null
        : roundRatio(targetContributionMargin),
    targetContributionAmount:
      targetContributionAmount === null
        ? null
        : roundMoney(targetContributionAmount),
    maximumMarketingCostAtTargetMargin:
      maximumMarketingCostAtTargetMargin === null
        ? null
        : roundMoney(maximumMarketingCostAtTargetMargin),
    targetRoas: targetRoas === null ? null : roundRatio(targetRoas),
    targetMarginFeasibleBeforeMarketing
  };
}

export function comparePilotScenarios(
  scenarios: PilotScenarioInput[]
): PilotScenarioComparison[] {
  if (scenarios.length < 2) {
    throw new Error("at least two scenarios are required for comparison");
  }

  const ids = new Set<string>();

  const comparisons = scenarios.map((scenario) => {
    assertScenarioId(scenario.id);

    if (ids.has(scenario.id)) {
      throw new Error(`duplicate scenario id: ${scenario.id}`);
    }

    ids.add(scenario.id);

    const economics = calculateProductEconomics(scenario.economics);
    const meetsTargetContributionMargin =
      economics.targetContributionMargin === null
        ? null
        : economics.contributionMarginAfterMarketing >=
          economics.targetContributionMargin;

    const viable =
      economics.contributionAfterMarketing >= 0 &&
      (meetsTargetContributionMargin ?? true);

    return {
      id: scenario.id,
      label: scenario.label ?? null,
      rank: 0,
      viable,
      meetsTargetContributionMargin,
      contributionAfterMarketing: economics.contributionAfterMarketing,
      contributionMarginAfterMarketing:
        economics.contributionMarginAfterMarketing,
      breakEvenRoas: economics.breakEvenRoas,
      targetRoas: economics.targetRoas,
      economics
    };
  });

  comparisons.sort((a, b) => {
    if (a.viable !== b.viable) {
      return a.viable ? -1 : 1;
    }

    if (a.contributionAfterMarketing !== b.contributionAfterMarketing) {
      return b.contributionAfterMarketing - a.contributionAfterMarketing;
    }

    if (
      a.contributionMarginAfterMarketing !==
      b.contributionMarginAfterMarketing
    ) {
      return (
        b.contributionMarginAfterMarketing -
        a.contributionMarginAfterMarketing
      );
    }

    return a.id.localeCompare(b.id);
  });

  return comparisons.map((comparison, index) => ({
    ...comparison,
    rank: index + 1
  }));
}
