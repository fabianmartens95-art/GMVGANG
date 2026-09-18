export const FULL_PROFITABILITY_INPUTS = [
  "grossMerchandiseValue",
  "vatRate",
  "refundsGross",
  "discountsGross",
  "cogs",
  "fulfillmentCost",
  "affiliateCommissionCost",
  "paidMediaCost",
  "agencyFees",
  "paymentFees",
  "platformFees",
  "otherVariableCosts",
] as const;

export type FullProfitabilityInputKey = (typeof FULL_PROFITABILITY_INPUTS)[number];

export type FullProfitabilityInput = Partial<
  Record<FullProfitabilityInputKey, number | null | undefined>
>;

export type FullProfitabilityValues = Record<FullProfitabilityInputKey, number>;

export type ProfitabilityReadiness =
  | {
      status: "incomplete";
      readyForFullProfitability: false;
      missing: FullProfitabilityInputKey[];
      explicitZeroInputs: FullProfitabilityInputKey[];
    }
  | {
      status: "ready";
      readyForFullProfitability: true;
      missing: [];
      explicitZeroInputs: FullProfitabilityInputKey[];
      values: FullProfitabilityValues;
    };

function validateValue(key: FullProfitabilityInputKey, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`PROFITABILITY_INPUT_INVALID:${key}`);
  }
  if (key === "vatRate" && value >= 1) {
    throw new Error("PROFITABILITY_INPUT_INVALID:vatRate");
  }
}

export function evaluateFullProfitabilityReadiness(
  input: FullProfitabilityInput,
): ProfitabilityReadiness {
  const missing: FullProfitabilityInputKey[] = [];
  const explicitZeroInputs: FullProfitabilityInputKey[] = [];
  const values = {} as FullProfitabilityValues;

  for (const key of FULL_PROFITABILITY_INPUTS) {
    const value = input[key];
    if (value === undefined || value === null) {
      missing.push(key);
      continue;
    }
    validateValue(key, value);
    values[key] = value;
    if (value === 0) explicitZeroInputs.push(key);
  }

  if (missing.length > 0) {
    return {
      status: "incomplete",
      readyForFullProfitability: false,
      missing,
      explicitZeroInputs,
    };
  }

  if (values.refundsGross + values.discountsGross > values.grossMerchandiseValue) {
    throw new Error("PROFITABILITY_REVENUE_ADJUSTMENTS_EXCEED_GMV");
  }

  return {
    status: "ready",
    readyForFullProfitability: true,
    missing: [],
    explicitZeroInputs,
    values,
  };
}

export function requireFullProfitabilityInputs(
  input: FullProfitabilityInput,
): FullProfitabilityValues {
  const readiness = evaluateFullProfitabilityReadiness(input);
  if (!readiness.readyForFullProfitability) {
    throw new Error(
      `PROFITABILITY_INPUTS_INCOMPLETE:${readiness.missing.join(",")}`,
    );
  }
  return readiness.values;
}
