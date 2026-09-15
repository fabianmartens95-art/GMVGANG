export type QualificationStatus = "qualified" | "review" | "reject";

export type QualificationHardGate = {
  passed: boolean;
  reason?: string;
};

export type QualificationCriterionInput = {
  id: string;
  label?: string;
  score: number;
  weight: number;
  hardGate?: QualificationHardGate;
};

export type QualificationThresholds = {
  qualifiedMinScore: number;
  reviewMinScore: number;
};

export type QualificationInput = {
  criteria: QualificationCriterionInput[];
  thresholds: QualificationThresholds;
};

export type QualificationCriterionResult = {
  id: string;
  label: string | null;
  score: number;
  weight: number;
  normalizedWeight: number;
  weightedContribution: number;
  hardGatePassed: boolean | null;
  hardGateReason: string | null;
};

export type QualificationResult = {
  score: number;
  status: QualificationStatus;
  hardGateFailed: boolean;
  hardGateFailures: Array<{
    criterionId: string;
    reason: string | null;
  }>;
  criteria: QualificationCriterionResult[];
};

function assertFiniteInRange(
  value: number,
  min: number,
  max: number,
  field: string
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a finite number between ${min} and ${max}`);
  }
}

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a finite number greater than 0`);
  }
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function validateThresholds(thresholds: QualificationThresholds): void {
  assertFiniteInRange(
    thresholds.qualifiedMinScore,
    0,
    100,
    "qualifiedMinScore"
  );
  assertFiniteInRange(
    thresholds.reviewMinScore,
    0,
    100,
    "reviewMinScore"
  );

  if (thresholds.reviewMinScore > thresholds.qualifiedMinScore) {
    throw new Error(
      "reviewMinScore must be less than or equal to qualifiedMinScore"
    );
  }
}

function statusForScore(
  score: number,
  thresholds: QualificationThresholds
): QualificationStatus {
  if (score >= thresholds.qualifiedMinScore) {
    return "qualified";
  }

  if (score >= thresholds.reviewMinScore) {
    return "review";
  }

  return "reject";
}

export function qualifyBrand(input: QualificationInput): QualificationResult {
  if (input.criteria.length === 0) {
    throw new Error("at least one qualification criterion is required");
  }

  validateThresholds(input.thresholds);

  const ids = new Set<string>();
  let totalWeight = 0;

  for (const criterion of input.criteria) {
    assertNonEmptyId(criterion.id, "criterion id");

    if (ids.has(criterion.id)) {
      throw new Error(`duplicate criterion id: ${criterion.id}`);
    }

    ids.add(criterion.id);
    assertFiniteInRange(criterion.score, 0, 100, `${criterion.id}.score`);
    assertPositiveFinite(criterion.weight, `${criterion.id}.weight`);
    totalWeight += criterion.weight;
  }

  const criteria = input.criteria.map((criterion) => {
    const normalizedWeight = criterion.weight / totalWeight;
    const weightedContribution = criterion.score * normalizedWeight;

    return {
      id: criterion.id,
      label: criterion.label ?? null,
      score: roundScore(criterion.score),
      weight: roundScore(criterion.weight),
      normalizedWeight: roundScore(normalizedWeight),
      weightedContribution: roundScore(weightedContribution),
      hardGatePassed: criterion.hardGate?.passed ?? null,
      hardGateReason: criterion.hardGate?.reason ?? null
    } satisfies QualificationCriterionResult;
  });

  const rawScore = input.criteria.reduce(
    (sum, criterion) => sum + criterion.score * criterion.weight,
    0
  ) / totalWeight;
  const score = roundScore(rawScore);

  const hardGateFailures = input.criteria
    .filter((criterion) => criterion.hardGate?.passed === false)
    .map((criterion) => ({
      criterionId: criterion.id,
      reason: criterion.hardGate?.reason ?? null
    }));

  const hardGateFailed = hardGateFailures.length > 0;
  const status = hardGateFailed
    ? "reject"
    : statusForScore(score, input.thresholds);

  return {
    score,
    status,
    hardGateFailed,
    hardGateFailures,
    criteria
  };
}
