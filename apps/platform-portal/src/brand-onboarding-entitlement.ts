export type BrandOnboardingField =
  | "legal_name"
  | "country_code"
  | "contact_name"
  | "contact_email"
  | "primary_goal";

export type BrandOnboardingNextAction =
  | "add_legal_name"
  | "add_country"
  | "add_contact"
  | "add_contact_email"
  | "choose_primary_goal"
  | "onboarding_complete";

export type BrandPlan =
  | "brand_core"
  | "brand_growth"
  | "managed_growth"
  | "enterprise";

export type BrandWorkspaceMode = "full_access" | "read_only";
export type BrandEntitlementSource = "trial" | "paid" | "none";

export type BrandOnboardingEntitlementResponse = {
  onboarding: {
    completionPercent: number;
    complete: boolean;
    missingFields: BrandOnboardingField[];
    nextBestAction: BrandOnboardingNextAction;
  };
  entitlement: {
    mode: BrandWorkspaceMode;
    source: BrandEntitlementSource;
    plan: BrandPlan | null;
    reason:
      | "paid_plan_active"
      | "trial_active"
      | "trial_expired"
      | "trial_not_started"
      | "no_entitlement";
    trial: {
      status: "not_started" | "active" | "expired";
      startsAt: string | null;
      endsAt: string | null;
      daysRemaining: number | null;
    };
  };
};

export interface BrandOnboardingEntitlementPort {
  getStatus(): Promise<BrandOnboardingEntitlementResponse | null>;
}

type StatusFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const REQUIRED_FIELDS: readonly BrandOnboardingField[] = [
  "legal_name",
  "country_code",
  "contact_name",
  "contact_email",
  "primary_goal",
];

const NEXT_BY_FIELD: Record<BrandOnboardingField, BrandOnboardingNextAction> = {
  legal_name: "add_legal_name",
  country_code: "add_country",
  contact_name: "add_contact",
  contact_email: "add_contact_email",
  primary_goal: "choose_primary_goal",
};

const PLANS = new Set<BrandPlan>([
  "brand_core",
  "brand_growth",
  "managed_growth",
  "enterprise",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function parseMissingFields(value: unknown): BrandOnboardingField[] {
  if (!Array.isArray(value)) throw new Error("BRAND_STATUS_ONBOARDING_INVALID");
  const result: BrandOnboardingField[] = [];
  const seen = new Set<BrandOnboardingField>();
  for (const item of value) {
    if (typeof item !== "string" || !REQUIRED_FIELDS.includes(item as BrandOnboardingField)) {
      throw new Error("BRAND_STATUS_ONBOARDING_INVALID");
    }
    const field = item as BrandOnboardingField;
    if (seen.has(field)) throw new Error("BRAND_STATUS_ONBOARDING_INVALID");
    seen.add(field);
    result.push(field);
  }

  const canonical = REQUIRED_FIELDS.filter((field) => seen.has(field));
  if (canonical.some((field, index) => result[index] !== field)) {
    throw new Error("BRAND_STATUS_ONBOARDING_INVALID");
  }
  return result;
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }
  return value;
}

function parseOnboarding(value: unknown): BrandOnboardingEntitlementResponse["onboarding"] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["completionPercent", "complete", "missingFields", "nextBestAction"])
  ) {
    throw new Error("BRAND_STATUS_ONBOARDING_INVALID");
  }

  const missingFields = parseMissingFields(value.missingFields);
  const expectedPercent = Math.round(((REQUIRED_FIELDS.length - missingFields.length) / REQUIRED_FIELDS.length) * 100);
  if (
    !Number.isInteger(value.completionPercent) ||
    value.completionPercent !== expectedPercent ||
    typeof value.complete !== "boolean" ||
    value.complete !== (missingFields.length === 0)
  ) {
    throw new Error("BRAND_STATUS_ONBOARDING_INCONSISTENT");
  }

  const expectedNext = missingFields[0] ? NEXT_BY_FIELD[missingFields[0]] : "onboarding_complete";
  if (value.nextBestAction !== expectedNext) {
    throw new Error("BRAND_STATUS_ONBOARDING_INCONSISTENT");
  }

  return {
    completionPercent: value.completionPercent,
    complete: value.complete,
    missingFields,
    nextBestAction: expectedNext,
  };
}

function parseEntitlement(value: unknown): BrandOnboardingEntitlementResponse["entitlement"] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["mode", "source", "plan", "reason", "trial"]) ||
    !isRecord(value.trial) ||
    !hasOnlyKeys(value.trial, ["status", "startsAt", "endsAt", "daysRemaining"])
  ) {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }

  const mode = value.mode;
  const source = value.source;
  const plan = value.plan;
  const reason = value.reason;
  const trialStatus = value.trial.status;
  const startsAt = nullableTimestamp(value.trial.startsAt);
  const endsAt = nullableTimestamp(value.trial.endsAt);
  const daysRemaining = value.trial.daysRemaining;

  if (mode !== "full_access" && mode !== "read_only") {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }
  if (source !== "trial" && source !== "paid" && source !== "none") {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }
  if (
    trialStatus !== "not_started" &&
    trialStatus !== "active" &&
    trialStatus !== "expired"
  ) {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }
  if (
    daysRemaining !== null &&
    (!Number.isInteger(daysRemaining) || (daysRemaining as number) < 0)
  ) {
    throw new Error("BRAND_STATUS_ENTITLEMENT_INVALID");
  }

  if (source === "none") {
    if (
      mode !== "read_only" ||
      plan !== null ||
      reason !== "no_entitlement" ||
      trialStatus !== "not_started" ||
      startsAt !== null ||
      endsAt !== null ||
      daysRemaining !== null
    ) {
      throw new Error("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
    }
  } else if (source === "paid") {
    if (
      typeof plan !== "string" ||
      !PLANS.has(plan as BrandPlan) ||
      trialStatus !== "not_started" ||
      startsAt !== null ||
      endsAt !== null ||
      daysRemaining !== null
    ) {
      throw new Error("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
    }
    const paidActive = mode === "full_access" && reason === "paid_plan_active";
    const paidInactive = mode === "read_only" && reason === "no_entitlement";
    if (!paidActive && !paidInactive) {
      throw new Error("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
    }
  } else {
    if (
      plan !== null ||
      startsAt === null ||
      endsAt === null ||
      Date.parse(endsAt) <= Date.parse(startsAt)
    ) {
      throw new Error("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
    }

    const active =
      trialStatus === "active" &&
      mode === "full_access" &&
      reason === "trial_active" &&
      typeof daysRemaining === "number" &&
      daysRemaining >= 1;
    const expired =
      trialStatus === "expired" &&
      mode === "read_only" &&
      reason === "trial_expired" &&
      daysRemaining === 0;
    const notStarted =
      trialStatus === "not_started" &&
      mode === "read_only" &&
      reason === "trial_not_started" &&
      typeof daysRemaining === "number" &&
      daysRemaining >= 1;

    if (!active && !expired && !notStarted) {
      throw new Error("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
    }
  }

  return {
    mode,
    source,
    plan: plan as BrandPlan | null,
    reason: reason as BrandOnboardingEntitlementResponse["entitlement"]["reason"],
    trial: {
      status: trialStatus,
      startsAt,
      endsAt,
      daysRemaining: daysRemaining as number | null,
    },
  };
}

export function parseBrandOnboardingEntitlement(
  payload: unknown,
): BrandOnboardingEntitlementResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["onboarding", "entitlement"])
  ) {
    throw new Error("BRAND_STATUS_PAYLOAD_INVALID");
  }

  return {
    onboarding: parseOnboarding(payload.onboarding),
    entitlement: parseEntitlement(payload.entitlement),
  };
}

export class HttpBrandOnboardingEntitlementAdapter
implements BrandOnboardingEntitlementPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/onboarding-entitlement",
    private readonly request: StatusFetch = (input, init) => fetch(input, init),
  ) {}

  async getStatus(): Promise<BrandOnboardingEntitlementResponse | null> {
    if (!this.organizationId.trim()) return null;
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": this.organizationId,
        },
      });
      if (!response.ok) return null;
      return parseBrandOnboardingEntitlement(await response.json());
    } catch {
      return null;
    }
  }
}

const FIELD_LABELS: Record<BrandOnboardingField, string> = {
  legal_name: "Unternehmensname",
  country_code: "Land",
  contact_name: "Ansprechpartner",
  contact_email: "Kontakt-E-Mail",
  primary_goal: "Primäres Ziel",
};

const NEXT_LABELS: Record<BrandOnboardingNextAction, string> = {
  add_legal_name: "Unternehmensname ergänzen",
  add_country: "Land ergänzen",
  add_contact: "Ansprechpartner ergänzen",
  add_contact_email: "Kontakt-E-Mail ergänzen",
  choose_primary_goal: "Primäres Ziel auswählen",
  onboarding_complete: "Onboarding vollständig",
};

const PLAN_LABELS: Record<BrandPlan, string> = {
  brand_core: "Brand Core",
  brand_growth: "Brand Growth",
  managed_growth: "Managed Growth",
  enterprise: "Enterprise",
};

export function renderBrandOnboardingEntitlement(
  response: BrandOnboardingEntitlementResponse | null,
): string {
  if (!response) {
    return `<section class="brand-status brand-status--empty"><span class="eyebrow">BRAND STATUS</span><h2>Status nicht verfügbar</h2><p>Onboarding und Zugriff werden erst angezeigt, wenn der serverseitige Workspace-Status belastbar gelesen werden kann.</p></section>`;
  }

  const { onboarding, entitlement } = response;
  const missing = onboarding.missingFields.length
    ? `<ul>${onboarding.missingFields.map((field) => `<li>${FIELD_LABELS[field]}</li>`).join("")}</ul>`
    : "<p>Alle erforderlichen Onboarding-Felder sind vollständig.</p>";

  let accessTitle = "Read-only";
  let accessDetail = "Der Workspace bleibt lesbar; schreibende Aktionen sind serverseitig gesperrt.";
  if (entitlement.mode === "full_access") {
    accessTitle = "Voller Zugriff";
    accessDetail = entitlement.source === "trial"
      ? `Trial aktiv · ${entitlement.trial.daysRemaining} Tag(e) verbleibend.`
      : `${PLAN_LABELS[entitlement.plan as BrandPlan]} aktiv.`;
  } else if (entitlement.source === "trial" && entitlement.reason === "trial_expired") {
    accessDetail = "Der Trial ist abgelaufen. Workspace-Daten bleiben lesbar; Mutationen sind serverseitig gesperrt.";
  } else if (entitlement.source === "trial" && entitlement.reason === "trial_not_started") {
    accessDetail = "Der Trial ist noch nicht aktiv. Der Browser startet oder berechnet keinen Trial.";
  } else if (entitlement.source === "paid" && entitlement.plan) {
    accessDetail = `${PLAN_LABELS[entitlement.plan]} ist aktuell nicht aktiv; der Workspace bleibt read-only.`;
  }

  return `<section class="brand-status">
    <div class="brand-status__header"><div><span class="eyebrow">BRAND STATUS</span><h2>Onboarding & Zugriff</h2></div><span class="brand-status__mode brand-status__mode--${entitlement.mode}">${accessTitle}</span></div>
    <div class="brand-status__grid">
      <article>
        <span>Onboarding</span>
        <strong>${onboarding.completionPercent}%</strong>
        <p>Nächster Schritt: ${NEXT_LABELS[onboarding.nextBestAction]}</p>
        ${missing}
      </article>
      <article>
        <span>Zugriffsmodus</span>
        <strong>${accessTitle}</strong>
        <p>${accessDetail}</p>
      </article>
    </div>
  </section>`;
}
