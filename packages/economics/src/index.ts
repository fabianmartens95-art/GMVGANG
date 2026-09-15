export type ProductEconomicsInput = {
  sellingPriceGross: number;
  vatRate: number;
  cogs: number;
  fulfillmentCost?: number;
  paymentCost?: number;
  returnsReserve?: number;
  affiliateCommissionRate?: number;
  paidMediaCostPerOrder?: number;
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

  assertFiniteNonNegative(fulfillmentCost, "fulfillmentCost");
  assertFiniteNonNegative(paymentCost, "paymentCost");
  assertFiniteNonNegative(returnsReserve, "returnsReserve");
  assertRate(affiliateCommissionRate, "affiliateCommissionRate");
  assertFiniteNonNegative(paidMediaCostPerOrder, "paidMediaCostPerOrder");

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
    )
  };
}
