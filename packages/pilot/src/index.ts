export type PilotReadiness = "ready" | "review" | "blocked";
export type PilotCheckSeverity = "block" | "review";
export type QualificationStatus = "qualified" | "review" | "reject";

export type PilotQualificationSummary = {
  score: number;
  status: QualificationStatus;
  hardGateFailed?: boolean;
};

export type PilotEconomicsSummary = {
  scenarioId: string;
  viable: boolean;
  netRevenuePerOrder: number;
  paidMediaCostPerOrder: number;
  contributionAfterMarketingPerOrder: number;
  contributionMarginAfterMarketing: number;
  breakEvenRoas: number | null;
  targetRoas?: number | null;
};

export type PilotTargets = {
  targetOrders: number;
  creatorCount: number;
  durationDays: number;
};

export type PilotGuardrails = {
  maxPaidMediaBudget: number;
  minContributionMargin?: number;
  minRoas?: number;
};

export type PilotOperationalCheck = {
  id: string;
  label?: string;
  passed: boolean;
  severity: PilotCheckSeverity;
  reason?: string;
};

export type PilotGeneratorInput = {
  qualification: PilotQualificationSummary;
  economics: PilotEconomicsSummary;
  targets: PilotTargets;
  guardrails: PilotGuardrails;
  operationalChecks?: PilotOperationalCheck[];
};

export type PilotReason = {
  code: string;
  severity: PilotCheckSeverity;
  message: string;
};

export type PilotGeneratorResult = {
  readiness: PilotReadiness;
  scenarioId: string;
  qualificationScore: number;
  qualificationStatus: QualificationStatus;
  targetOrders: number;
  creatorCount: number;
  durationDays: number;
  forecastNetRevenue: number;
  forecastPaidMediaSpend: number;
  forecastContributionAfterMarketing: number;
  projectedRoas: number | null;
  contributionMarginAfterMarketing: number;
  maxPaidMediaBudget: number;
  budgetWithinGuardrail: boolean;
  reasons: PilotReason[];
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
}

function assertNonNegative(value: number, field: string): void {
  assertFinite(value, field);
  if (value < 0) {
    throw new Error(`${field} must be non-negative`);
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be empty`);
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function generatePilotPlan(
  input: PilotGeneratorInput
): PilotGeneratorResult {
  assertFinite(input.qualification.score, "qualification.score");
  if (input.qualification.score < 0 || input.qualification.score > 100) {
    throw new Error("qualification.score must be between 0 and 100");
  }

  assertNonEmpty(input.economics.scenarioId, "economics.scenarioId");
  assertNonNegative(input.economics.netRevenuePerOrder, "economics.netRevenuePerOrder");
  assertNonNegative(
    input.economics.paidMediaCostPerOrder,
    "economics.paidMediaCostPerOrder"
  );
  assertFinite(
    input.economics.contributionAfterMarketingPerOrder,
    "economics.contributionAfterMarketingPerOrder"
  );
  assertFinite(
    input.economics.contributionMarginAfterMarketing,
    "economics.contributionMarginAfterMarketing"
  );

  if (input.economics.breakEvenRoas !== null) {
    assertNonNegative(input.economics.breakEvenRoas, "economics.breakEvenRoas");
  }
  if (input.economics.targetRoas !== undefined && input.economics.targetRoas !== null) {
    assertNonNegative(input.economics.targetRoas, "economics.targetRoas");
  }

  assertPositiveInteger(input.targets.targetOrders, "targets.targetOrders");
  assertPositiveInteger(input.targets.creatorCount, "targets.creatorCount");
  assertPositiveInteger(input.targets.durationDays, "targets.durationDays");
  assertNonNegative(input.guardrails.maxPaidMediaBudget, "guardrails.maxPaidMediaBudget");

  if (input.guardrails.minContributionMargin !== undefined) {
    assertFinite(
      input.guardrails.minContributionMargin,
      "guardrails.minContributionMargin"
    );
  }
  if (input.guardrails.minRoas !== undefined) {
    assertNonNegative(input.guardrails.minRoas, "guardrails.minRoas");
  }

  const checks = input.operationalChecks ?? [];
  const checkIds = new Set<string>();
  for (const check of checks) {
    assertNonEmpty(check.id, "operational check id");
    if (checkIds.has(check.id)) {
      throw new Error(`duplicate operational check id: ${check.id}`);
    }
    checkIds.add(check.id);
  }

  const forecastNetRevenue =
    input.economics.netRevenuePerOrder * input.targets.targetOrders;
  const forecastPaidMediaSpend =
    input.economics.paidMediaCostPerOrder * input.targets.targetOrders;
  const forecastContributionAfterMarketing =
    input.economics.contributionAfterMarketingPerOrder * input.targets.targetOrders;
  const projectedRoas =
    forecastPaidMediaSpend > 0
      ? forecastNetRevenue / forecastPaidMediaSpend
      : null;
  const budgetWithinGuardrail =
    forecastPaidMediaSpend <= input.guardrails.maxPaidMediaBudget;

  const reasons: PilotReason[] = [];

  if (input.qualification.hardGateFailed === true) {
    reasons.push({
      code: "qualification_hard_gate_failed",
      severity: "block",
      message: "Brand qualification contains a failed hard gate."
    });
  }

  if (input.qualification.status === "reject") {
    reasons.push({
      code: "qualification_rejected",
      severity: "block",
      message: "Brand qualification status is reject."
    });
  } else if (input.qualification.status === "review") {
    reasons.push({
      code: "qualification_review",
      severity: "review",
      message: "Brand qualification requires review."
    });
  }

  if (!input.economics.viable) {
    reasons.push({
      code: "economics_not_viable",
      severity: "block",
      message: "Selected economics scenario is not viable."
    });
  }

  if (!budgetWithinGuardrail) {
    reasons.push({
      code: "paid_media_budget_exceeded",
      severity: "block",
      message: "Forecast paid-media spend exceeds the caller-provided budget guardrail."
    });
  }

  if (
    input.guardrails.minContributionMargin !== undefined &&
    input.economics.contributionMarginAfterMarketing <
      input.guardrails.minContributionMargin
  ) {
    reasons.push({
      code: "contribution_margin_below_guardrail",
      severity: "block",
      message: "Contribution margin is below the caller-provided minimum."
    });
  }

  if (
    input.guardrails.minRoas !== undefined &&
    projectedRoas !== null &&
    projectedRoas < input.guardrails.minRoas
  ) {
    reasons.push({
      code: "roas_below_guardrail",
      severity: "block",
      message: "Projected ROAS is below the caller-provided minimum."
    });
  }

  for (const check of checks) {
    if (!check.passed) {
      reasons.push({
        code: `operational_check:${check.id}`,
        severity: check.severity,
        message:
          check.reason ??
          `${check.label ?? check.id} operational check did not pass.`
      });
    }
  }

  const readiness: PilotReadiness = reasons.some(
    (reason) => reason.severity === "block"
  )
    ? "blocked"
    : reasons.some((reason) => reason.severity === "review")
      ? "review"
      : "ready";

  return {
    readiness,
    scenarioId: input.economics.scenarioId,
    qualificationScore: roundRatio(input.qualification.score),
    qualificationStatus: input.qualification.status,
    targetOrders: input.targets.targetOrders,
    creatorCount: input.targets.creatorCount,
    durationDays: input.targets.durationDays,
    forecastNetRevenue: roundMoney(forecastNetRevenue),
    forecastPaidMediaSpend: roundMoney(forecastPaidMediaSpend),
    forecastContributionAfterMarketing: roundMoney(
      forecastContributionAfterMarketing
    ),
    projectedRoas: projectedRoas === null ? null : roundRatio(projectedRoas),
    contributionMarginAfterMarketing: roundRatio(
      input.economics.contributionMarginAfterMarketing
    ),
    maxPaidMediaBudget: roundMoney(input.guardrails.maxPaidMediaBudget),
    budgetWithinGuardrail,
    reasons
  };
}
