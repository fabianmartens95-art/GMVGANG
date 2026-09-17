export type BrandPlan =
  | "brand_core"
  | "brand_growth"
  | "managed_growth"
  | "enterprise";

export type BrandPlanCapability =
  | "workspace.write"
  | "products.manage"
  | "campaigns.manage"
  | "creator_discovery.read"
  | "analytics.basic"
  | "analytics.advanced"
  | "profitability.read"
  | "automations.use"
  | "priority_support"
  | "managed_operations"
  | "teams.advanced"
  | "integrations.custom"
  | "sla";

const PLAN_CAPABILITIES: Record<BrandPlan, readonly BrandPlanCapability[]> = {
  brand_core: [
    "workspace.write",
    "products.manage",
    "campaigns.manage",
    "creator_discovery.read",
    "analytics.basic",
  ],
  brand_growth: [
    "workspace.write",
    "products.manage",
    "campaigns.manage",
    "creator_discovery.read",
    "analytics.basic",
    "analytics.advanced",
    "profitability.read",
    "automations.use",
    "priority_support",
  ],
  managed_growth: [
    "workspace.write",
    "products.manage",
    "campaigns.manage",
    "creator_discovery.read",
    "analytics.basic",
    "analytics.advanced",
    "profitability.read",
    "automations.use",
    "priority_support",
    "managed_operations",
  ],
  enterprise: [
    "workspace.write",
    "products.manage",
    "campaigns.manage",
    "creator_discovery.read",
    "analytics.basic",
    "analytics.advanced",
    "profitability.read",
    "automations.use",
    "priority_support",
    "teams.advanced",
    "integrations.custom",
    "sla",
  ],
};

export function capabilitiesForBrandPlan(plan: BrandPlan): readonly BrandPlanCapability[] {
  return PLAN_CAPABILITIES[plan];
}

export function brandPlanHasCapability(
  plan: BrandPlan,
  capability: BrandPlanCapability,
): boolean {
  return PLAN_CAPABILITIES[plan].includes(capability);
}

export type BrandEntitlementSource =
  | {
      kind: "trial";
      onboardingCompletedAt: string;
      trialStartedAt: string;
      trialEndsAt: string;
    }
  | {
      kind: "paid";
      plan: BrandPlan;
      startsAt: string;
      endsAt: string | null;
    }
  | {
      kind: "none";
    };

export type BrandWorkspaceMode = "full_access" | "read_only";

export type BrandEntitlementReadModel = {
  mode: BrandWorkspaceMode;
  source: "trial" | "paid" | "none";
  plan: BrandPlan | null;
  trial: {
    status: "not_started" | "active" | "expired";
    startsAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
  };
  reason:
    | "paid_plan_active"
    | "trial_active"
    | "trial_expired"
    | "trial_not_started"
    | "no_entitlement";
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_BRAND_TRIAL_DAYS = 14;

function parseTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

export function createBrandTrial(input: {
  onboardingCompletedAt: string;
  now: string;
  trialDays?: number;
}): Extract<BrandEntitlementSource, { kind: "trial" }> {
  const onboardingMs = parseTimestamp(
    input.onboardingCompletedAt,
    "BRAND_TRIAL_ONBOARDING_TIMESTAMP_INVALID",
  );
  const nowMs = parseTimestamp(input.now, "BRAND_TRIAL_NOW_INVALID");
  if (nowMs < onboardingMs) throw new Error("BRAND_TRIAL_BEFORE_ONBOARDING_COMPLETION");

  const trialDays = input.trialDays ?? DEFAULT_BRAND_TRIAL_DAYS;
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) {
    throw new Error("BRAND_TRIAL_DAYS_INVALID");
  }

  return {
    kind: "trial",
    onboardingCompletedAt: input.onboardingCompletedAt,
    trialStartedAt: input.now,
    trialEndsAt: new Date(nowMs + trialDays * DAY_MS).toISOString(),
  };
}

export function resolveBrandEntitlement(
  entitlement: BrandEntitlementSource,
  now: string,
): BrandEntitlementReadModel {
  const nowMs = parseTimestamp(now, "BRAND_ENTITLEMENT_NOW_INVALID");

  if (entitlement.kind === "paid") {
    const startsMs = parseTimestamp(entitlement.startsAt, "BRAND_PLAN_START_INVALID");
    const endsMs = entitlement.endsAt
      ? parseTimestamp(entitlement.endsAt, "BRAND_PLAN_END_INVALID")
      : null;

    if (endsMs !== null && endsMs <= startsMs) throw new Error("BRAND_PLAN_WINDOW_INVALID");

    const active = nowMs >= startsMs && (endsMs === null || nowMs < endsMs);
    if (active) {
      return {
        mode: "full_access",
        source: "paid",
        plan: entitlement.plan,
        trial: {
          status: "not_started",
          startsAt: null,
          endsAt: null,
          daysRemaining: null,
        },
        reason: "paid_plan_active",
      };
    }

    return {
      mode: "read_only",
      source: "paid",
      plan: entitlement.plan,
      trial: {
        status: "not_started",
        startsAt: null,
        endsAt: null,
        daysRemaining: null,
      },
      reason: "no_entitlement",
    };
  }

  if (entitlement.kind === "trial") {
    const onboardingMs = parseTimestamp(
      entitlement.onboardingCompletedAt,
      "BRAND_TRIAL_ONBOARDING_TIMESTAMP_INVALID",
    );
    const startsMs = parseTimestamp(entitlement.trialStartedAt, "BRAND_TRIAL_START_INVALID");
    const endsMs = parseTimestamp(entitlement.trialEndsAt, "BRAND_TRIAL_END_INVALID");

    if (startsMs < onboardingMs) throw new Error("BRAND_TRIAL_BEFORE_ONBOARDING_COMPLETION");
    if (endsMs <= startsMs) throw new Error("BRAND_TRIAL_WINDOW_INVALID");

    const active = nowMs >= startsMs && nowMs < endsMs;
    const expired = nowMs >= endsMs;

    return {
      mode: active ? "full_access" : "read_only",
      source: "trial",
      plan: null,
      trial: {
        status: active ? "active" : expired ? "expired" : "not_started",
        startsAt: entitlement.trialStartedAt,
        endsAt: entitlement.trialEndsAt,
        daysRemaining: active
          ? Math.max(1, Math.ceil((endsMs - nowMs) / DAY_MS))
          : expired
            ? 0
            : Math.ceil((endsMs - startsMs) / DAY_MS),
      },
      reason: active ? "trial_active" : expired ? "trial_expired" : "trial_not_started",
    };
  }

  return {
    mode: "read_only",
    source: "none",
    plan: null,
    trial: {
      status: "not_started",
      startsAt: null,
      endsAt: null,
      daysRemaining: null,
    },
    reason: "no_entitlement",
  };
}

export function canMutateBrandWorkspace(
  entitlement: BrandEntitlementSource,
  now: string,
): boolean {
  return resolveBrandEntitlement(entitlement, now).mode === "full_access";
}
