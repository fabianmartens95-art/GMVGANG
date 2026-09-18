export type BrandBillingModel =
  | "revenue_share"
  | "retainer"
  | "hybrid"
  | "custom";

export type BrandPartnerAuthorizationStatus =
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

export type BrandBillingHistoryRow = {
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

export type BrandBillingResponse = {
  organizationId: string;
  billingModel: BrandBillingModel;
  revenueShareBps: number | null;
  partnerAuthorizationStatus: BrandPartnerAuthorizationStatus;
  history: BrandBillingHistoryRow[];
  totalsByCurrency: BrandBillingCurrencyTotals[];
};

export interface BrandBillingPort {
  getBilling(): Promise<BrandBillingResponse | null>;
}

type BillingFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const BILLING_MODELS = new Set<BrandBillingModel>([
  "revenue_share",
  "retainer",
  "hybrid",
  "custom",
]);
const AUTH_STATUSES = new Set<BrandPartnerAuthorizationStatus>([
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function requiredString(value: unknown, max: number, code: string): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function nullableString(value: unknown, max: number, code: string): string | null {
  if (value === null) return null;
  return requiredString(value, max, code);
}

function currency(value: unknown): string {
  if (typeof value !== "string") throw new Error("BRAND_BILLING_SURFACE_CURRENCY_INVALID");
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("BRAND_BILLING_SURFACE_CURRENCY_INVALID");
  }
  return normalized;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_BILLING_SURFACE_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

function safeInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(code);
  return value as number;
}

function shareBps(value: unknown, required: boolean): number | null {
  if (value === null) {
    if (required) throw new Error("BRAND_BILLING_SURFACE_SHARE_REQUIRED");
    return null;
  }
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10_000) {
    throw new Error("BRAND_BILLING_SURFACE_SHARE_INVALID");
  }
  return value as number;
}

function parseHistory(value: unknown): BrandBillingHistoryRow[] {
  if (!Array.isArray(value)) throw new Error("BRAND_BILLING_SURFACE_HISTORY_INVALID");
  const seen = new Set<string>();
  return value.map((raw): BrandBillingHistoryRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "id","kind","status","source","periodStart","periodEnd","recordedAt",
        "amountCents","currency","revenueShareBps","reference",
      ])
    ) {
      throw new Error("BRAND_BILLING_SURFACE_HISTORY_INVALID");
    }

    const id = requiredString(raw.id, 128, "BRAND_BILLING_SURFACE_HISTORY_INVALID");
    if (seen.has(id)) throw new Error("BRAND_BILLING_SURFACE_HISTORY_DUPLICATE");
    seen.add(id);

    if (
      typeof raw.kind !== "string" || !HISTORY_KINDS.has(raw.kind as BrandBillingHistoryKind) ||
      typeof raw.status !== "string" || !HISTORY_STATUSES.has(raw.status as BrandBillingHistoryStatus) ||
      typeof raw.source !== "string" || !HISTORY_SOURCES.has(raw.source as BrandBillingHistorySource)
    ) {
      throw new Error("BRAND_BILLING_SURFACE_HISTORY_INVALID");
    }

    const periodStart = timestamp(raw.periodStart);
    const periodEnd = timestamp(raw.periodEnd);
    if (Date.parse(periodEnd) <= Date.parse(periodStart)) {
      throw new Error("BRAND_BILLING_SURFACE_PERIOD_INVALID");
    }

    const kind = raw.kind as BrandBillingHistoryKind;
    const amountCents = safeInteger(raw.amountCents, "BRAND_BILLING_SURFACE_AMOUNT_INVALID");
    if (kind !== "adjustment" && amountCents < 0) {
      throw new Error("BRAND_BILLING_SURFACE_AMOUNT_INVALID");
    }

    return {
      id,
      kind,
      status: raw.status as BrandBillingHistoryStatus,
      source: raw.source as BrandBillingHistorySource,
      periodStart,
      periodEnd,
      recordedAt: timestamp(raw.recordedAt),
      amountCents,
      currency: currency(raw.currency),
      revenueShareBps: shareBps(raw.revenueShareBps, kind === "revenue_share"),
      reference: nullableString(raw.reference, 200, "BRAND_BILLING_SURFACE_REFERENCE_INVALID"),
    };
  });
}

function parseTotals(value: unknown): BrandBillingCurrencyTotals[] {
  if (!Array.isArray(value)) throw new Error("BRAND_BILLING_SURFACE_TOTALS_INVALID");
  const seen = new Set<string>();
  return value.map((raw): BrandBillingCurrencyTotals => {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ["currency","pendingCents","settledCents"])) {
      throw new Error("BRAND_BILLING_SURFACE_TOTALS_INVALID");
    }
    const code = currency(raw.currency);
    if (seen.has(code)) throw new Error("BRAND_BILLING_SURFACE_TOTALS_DUPLICATE");
    seen.add(code);
    return {
      currency: code,
      pendingCents: safeInteger(raw.pendingCents, "BRAND_BILLING_SURFACE_TOTALS_INVALID"),
      settledCents: safeInteger(raw.settledCents, "BRAND_BILLING_SURFACE_TOTALS_INVALID"),
    };
  });
}

export function parseBrandBilling(payload: unknown): BrandBillingResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, [
      "organizationId",
      "billingModel",
      "revenueShareBps",
      "partnerAuthorizationStatus",
      "history",
      "totalsByCurrency",
    ])
  ) {
    throw new Error("BRAND_BILLING_SURFACE_PAYLOAD_INVALID");
  }

  if (
    typeof payload.billingModel !== "string" ||
    !BILLING_MODELS.has(payload.billingModel as BrandBillingModel) ||
    typeof payload.partnerAuthorizationStatus !== "string" ||
    !AUTH_STATUSES.has(payload.partnerAuthorizationStatus as BrandPartnerAuthorizationStatus)
  ) {
    throw new Error("BRAND_BILLING_SURFACE_STATE_INVALID");
  }

  const model = payload.billingModel as BrandBillingModel;
  const revenueShareBps = shareBps(
    payload.revenueShareBps,
    model === "revenue_share" || model === "hybrid",
  );
  if (model === "retainer" && revenueShareBps !== null) {
    throw new Error("BRAND_BILLING_SURFACE_STATE_INCONSISTENT");
  }

  return {
    organizationId: requiredString(payload.organizationId, 128, "BRAND_BILLING_SURFACE_ORG_INVALID"),
    billingModel: model,
    revenueShareBps,
    partnerAuthorizationStatus: payload.partnerAuthorizationStatus as BrandPartnerAuthorizationStatus,
    history: parseHistory(payload.history),
    totalsByCurrency: parseTotals(payload.totalsByCurrency),
  };
}

export class HttpBrandBillingAdapter implements BrandBillingPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/billing",
    private readonly request: BillingFetch = (input, init) => fetch(input, init),
  ) {}

  async getBilling(): Promise<BrandBillingResponse | null> {
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
      const parsed = parseBrandBilling(await response.json());
      return parsed.organizationId === this.organizationId ? parsed : null;
    } catch {
      return null;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number, code: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

const MODEL_LABELS: Record<BrandBillingModel, string> = {
  revenue_share: "Revenue Share",
  retainer: "Retainer",
  hybrid: "Hybrid",
  custom: "Custom",
};
const AUTH_LABELS: Record<BrandPartnerAuthorizationStatus, string> = {
  not_connected: "Nicht verbunden",
  pending_authorization: "Autorisierung offen",
  authorized: "Autorisiert",
  revoked: "Autorisierung widerrufen",
  unavailable: "Nicht verfügbar",
};
const KIND_LABELS: Record<BrandBillingHistoryKind, string> = {
  revenue_share: "Revenue Share",
  retainer: "Retainer",
  adjustment: "Anpassung",
};
const STATUS_LABELS: Record<BrandBillingHistoryStatus, string> = {
  pending: "Offen",
  settled: "Abgerechnet",
  void: "Storniert",
};

export function renderBrandBilling(response: BrandBillingResponse | null): string {
  if (!response) {
    return `<section class="brand-billing brand-billing--empty"><span class="eyebrow">BILLING & REVENUE SHARE</span><h2>Abrechnungsstatus nicht verfügbar</h2><p>Es werden keine Beträge oder Revenue Shares erfunden, wenn keine serverseitigen Billing-Daten vorliegen.</p></section>`;
  }

  const share = response.revenueShareBps === null
    ? "Kein Revenue Share hinterlegt"
    : `${(response.revenueShareBps / 100).toFixed(2)} % Revenue Share`;

  const totals = response.totalsByCurrency.length
    ? response.totalsByCurrency.map((row) => `<article><span>${escapeHtml(row.currency)}</span><strong>${escapeHtml(money(row.settledCents, row.currency))}</strong><p>Abgerechnet · Offen: ${escapeHtml(money(row.pendingCents, row.currency))}</p></article>`).join("")
    : "<p>Noch keine aufgezeichneten Abrechnungssummen.</p>";

  const history = response.history.length
    ? response.history.map((row) => {
      const rate = row.revenueShareBps === null ? "" : ` · ${(row.revenueShareBps / 100).toFixed(2)} %`;
      const ref = row.reference ? `<p>Referenz: ${escapeHtml(row.reference)}</p>` : "";
      return `<article class="brand-billing__history-row">
        <div><strong>${escapeHtml(KIND_LABELS[row.kind])}</strong><span>${escapeHtml(STATUS_LABELS[row.status])}</span></div>
        <p>${escapeHtml(row.periodStart)} → ${escapeHtml(row.periodEnd)}</p>
        <p>${escapeHtml(money(row.amountCents, row.currency))}${rate}</p>
        ${ref}
      </article>`;
    }).join("")
    : "<p>Noch keine Abrechnungshistorie.</p>";

  return `<section class="brand-billing">
    <div class="brand-billing__header">
      <div><span class="eyebrow">BILLING & REVENUE SHARE</span><h2>${escapeHtml(MODEL_LABELS[response.billingModel])}</h2><p>${escapeHtml(share)}</p></div>
      <span class="brand-billing__auth">${escapeHtml(AUTH_LABELS[response.partnerAuthorizationStatus])}</span>
    </div>
    <div class="brand-billing__totals">${totals}</div>
    <div class="brand-billing__history"><h3>Abrechnungshistorie</h3>${history}</div>
    <p class="brand-billing__notice">Alle Beträge stammen aus aufgezeichneten Billing-Einträgen. Diese Ansicht berechnet keine Gebühr aus GMV und führt keine Zahlung aus.</p>
  </section>`;
}
