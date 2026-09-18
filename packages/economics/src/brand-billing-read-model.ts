export type BrandBillingModel =
  | "revenue_share"
  | "retainer"
  | "hybrid"
  | "custom";

export type TikTokPartnerAuthorizationStatus =
  | "not_connected"
  | "pending_authorization"
  | "authorized"
  | "revoked"
  | "unavailable";

export type BrandBillingHistoryKind =
  | "revenue_share"
  | "retainer"
  | "adjustment";

export type BrandBillingHistoryStatus =
  | "pending"
  | "settled"
  | "void";

export type BrandBillingHistorySource =
  | "tiktok_partner_payment"
  | "manual_reconciliation"
  | "contractual_retainer";

export type BrandBillingHistoryEntryInput = {
  id: string;
  kind: BrandBillingHistoryKind;
  status: BrandBillingHistoryStatus;
  source: BrandBillingHistorySource;
  periodStart: string;
  periodEnd: string;
  recordedAt: string;
  amountCents: number;
  currency: string;
  revenueShareBps?: number | null;
  reference?: string | null;
};

export type BrandBillingReadModelInput = {
  organizationId: string;
  billingModel: BrandBillingModel;
  revenueShareBps: number | null;
  partnerAuthorizationStatus: TikTokPartnerAuthorizationStatus;
  history: readonly BrandBillingHistoryEntryInput[];
};

export type BrandBillingHistoryEntry = {
  id: string;
  kind: BrandBillingHistoryKind;
  status: BrandBillingHistoryStatus;
  source: BrandBillingHistorySource;
  periodStart: string;
  periodEnd: string;
  recordedAt: string;
  amountCents: number;
  currency: string;
  revenueShareBps: number | null;
  reference: string | null;
};

export type BrandBillingCurrencyTotals = {
  currency: string;
  pendingCents: number;
  settledCents: number;
};

export type BrandBillingReadModel = {
  organizationId: string;
  billingModel: BrandBillingModel;
  revenueShareBps: number | null;
  partnerAuthorizationStatus: TikTokPartnerAuthorizationStatus;
  history: BrandBillingHistoryEntry[];
  totalsByCurrency: BrandBillingCurrencyTotals[];
};

const BILLING_MODELS = new Set<BrandBillingModel>([
  "revenue_share",
  "retainer",
  "hybrid",
  "custom",
]);

const AUTHORIZATION_STATUSES = new Set<TikTokPartnerAuthorizationStatus>([
  "not_connected",
  "pending_authorization",
  "authorized",
  "revoked",
  "unavailable",
]);

const HISTORY_KINDS = new Set<BrandBillingHistoryKind>([
  "revenue_share",
  "retainer",
  "adjustment",
]);

const HISTORY_STATUSES = new Set<BrandBillingHistoryStatus>([
  "pending",
  "settled",
  "void",
]);

const HISTORY_SOURCES = new Set<BrandBillingHistorySource>([
  "tiktok_partner_payment",
  "manual_reconciliation",
  "contractual_retainer",
]);

function requiredString(value: string, max: number, code: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function validCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("BRAND_BILLING_CURRENCY_INVALID");
  }
  return currency;
}

function validTimestamp(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function validShareBps(value: number, code: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new Error(code);
  }
  return value;
}

function normalizeAgreement(
  billingModel: BrandBillingModel,
  revenueShareBps: number | null,
): number | null {
  if (billingModel === "retainer") {
    if (revenueShareBps !== null) {
      throw new Error("BRAND_BILLING_RETAINER_SHARE_CONFLICT");
    }
    return null;
  }

  if (billingModel === "revenue_share" || billingModel === "hybrid") {
    if (revenueShareBps === null) {
      throw new Error("BRAND_BILLING_SHARE_REQUIRED");
    }
    return validShareBps(revenueShareBps, "BRAND_BILLING_SHARE_INVALID");
  }

  if (revenueShareBps === null) return null;
  return validShareBps(revenueShareBps, "BRAND_BILLING_SHARE_INVALID");
}

function normalizeHistoryEntry(
  input: BrandBillingHistoryEntryInput,
): BrandBillingHistoryEntry {
  if (!HISTORY_KINDS.has(input.kind)) {
    throw new Error("BRAND_BILLING_HISTORY_KIND_INVALID");
  }
  if (!HISTORY_STATUSES.has(input.status)) {
    throw new Error("BRAND_BILLING_HISTORY_STATUS_INVALID");
  }
  if (!HISTORY_SOURCES.has(input.source)) {
    throw new Error("BRAND_BILLING_HISTORY_SOURCE_INVALID");
  }

  const periodStart = validTimestamp(
    input.periodStart,
    "BRAND_BILLING_HISTORY_TIMESTAMP_INVALID",
  );
  const periodEnd = validTimestamp(
    input.periodEnd,
    "BRAND_BILLING_HISTORY_TIMESTAMP_INVALID",
  );
  const recordedAt = validTimestamp(
    input.recordedAt,
    "BRAND_BILLING_HISTORY_TIMESTAMP_INVALID",
  );

  if (Date.parse(periodEnd) <= Date.parse(periodStart)) {
    throw new Error("BRAND_BILLING_HISTORY_PERIOD_INVALID");
  }

  if (!Number.isSafeInteger(input.amountCents)) {
    throw new Error("BRAND_BILLING_HISTORY_AMOUNT_INVALID");
  }
  if (input.kind !== "adjustment" && input.amountCents < 0) {
    throw new Error("BRAND_BILLING_HISTORY_AMOUNT_INVALID");
  }

  let revenueShareBps: number | null = null;
  if (input.kind === "revenue_share") {
    if (input.revenueShareBps === null || input.revenueShareBps === undefined) {
      throw new Error("BRAND_BILLING_HISTORY_SHARE_REQUIRED");
    }
    revenueShareBps = validShareBps(
      input.revenueShareBps,
      "BRAND_BILLING_HISTORY_SHARE_INVALID",
    );
  } else if (input.revenueShareBps !== null && input.revenueShareBps !== undefined) {
    throw new Error("BRAND_BILLING_HISTORY_SHARE_CONFLICT");
  }

  const reference = input.reference?.trim() || null;
  if (reference !== null && reference.length > 200) {
    throw new Error("BRAND_BILLING_HISTORY_REFERENCE_INVALID");
  }

  return {
    id: requiredString(input.id, 128, "BRAND_BILLING_HISTORY_ID_INVALID"),
    kind: input.kind,
    status: input.status,
    source: input.source,
    periodStart,
    periodEnd,
    recordedAt,
    amountCents: input.amountCents,
    currency: validCurrency(input.currency),
    revenueShareBps,
    reference,
  };
}

function buildTotals(
  history: readonly BrandBillingHistoryEntry[],
): BrandBillingCurrencyTotals[] {
  const totals = new Map<string, BrandBillingCurrencyTotals>();

  for (const entry of history) {
    if (entry.status === "void") continue;
    const current = totals.get(entry.currency) ?? {
      currency: entry.currency,
      pendingCents: 0,
      settledCents: 0,
    };

    if (entry.status === "pending") {
      current.pendingCents += entry.amountCents;
    } else {
      current.settledCents += entry.amountCents;
    }

    if (
      !Number.isSafeInteger(current.pendingCents) ||
      !Number.isSafeInteger(current.settledCents)
    ) {
      throw new Error("BRAND_BILLING_TOTAL_OVERFLOW");
    }
    totals.set(entry.currency, current);
  }

  return [...totals.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency)
  );
}

export function buildBrandBillingReadModel(
  input: BrandBillingReadModelInput,
): BrandBillingReadModel {
  const organizationId = requiredString(
    input.organizationId,
    128,
    "BRAND_BILLING_ORGANIZATION_REQUIRED",
  );

  if (!BILLING_MODELS.has(input.billingModel)) {
    throw new Error("BRAND_BILLING_MODEL_INVALID");
  }
  if (!AUTHORIZATION_STATUSES.has(input.partnerAuthorizationStatus)) {
    throw new Error("BRAND_BILLING_AUTHORIZATION_STATUS_INVALID");
  }

  const revenueShareBps = normalizeAgreement(
    input.billingModel,
    input.revenueShareBps,
  );

  const seenIds = new Set<string>();
  const history = input.history.map((entry) => {
    const normalized = normalizeHistoryEntry(entry);
    if (seenIds.has(normalized.id)) {
      throw new Error("BRAND_BILLING_HISTORY_DUPLICATE_ID");
    }
    seenIds.add(normalized.id);
    return normalized;
  }).sort((left, right) =>
    Date.parse(right.recordedAt) - Date.parse(left.recordedAt) ||
    left.id.localeCompare(right.id)
  );

  return {
    organizationId,
    billingModel: input.billingModel,
    revenueShareBps,
    partnerAuthorizationStatus: input.partnerAuthorizationStatus,
    history,
    totalsByCurrency: buildTotals(history),
  };
}
