export const PROFITABILITY_INPUT_KEYS = [
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

export type ProfitabilityInputKey = (typeof PROFITABILITY_INPUT_KEYS)[number];

export type ProfitabilityReadinessResponse = {
  status: "ready" | "incomplete";
  readyForFullProfitability: boolean;
  missing: ProfitabilityInputKey[];
  explicitZeroInputs: ProfitabilityInputKey[];
};

export interface ProfitabilityReadinessPort {
  getReadiness(): Promise<ProfitabilityReadinessResponse | null>;
}

type ReadinessFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const KNOWN_INPUTS = new Set<ProfitabilityInputKey>(PROFITABILITY_INPUT_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function parseInputKeys(value: unknown, error: string): ProfitabilityInputKey[] {
  if (!Array.isArray(value)) throw new Error(error);
  const result: ProfitabilityInputKey[] = [];
  const seen = new Set<ProfitabilityInputKey>();
  for (const item of value) {
    if (typeof item !== "string" || !KNOWN_INPUTS.has(item as ProfitabilityInputKey)) {
      throw new Error(error);
    }
    const key = item as ProfitabilityInputKey;
    if (seen.has(key)) throw new Error(error);
    seen.add(key);
    result.push(key);
  }

  const canonical = PROFITABILITY_INPUT_KEYS.filter((key) => seen.has(key));
  if (canonical.some((key, index) => result[index] !== key)) {
    throw new Error(error);
  }
  return result;
}

export function parseProfitabilityReadiness(
  payload: unknown,
): ProfitabilityReadinessResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, [
      "status",
      "readyForFullProfitability",
      "missing",
      "explicitZeroInputs",
    ])
  ) {
    throw new Error("PROFITABILITY_READINESS_PAYLOAD_INVALID");
  }

  if (payload.status !== "ready" && payload.status !== "incomplete") {
    throw new Error("PROFITABILITY_READINESS_STATE_INVALID");
  }
  if (typeof payload.readyForFullProfitability !== "boolean") {
    throw new Error("PROFITABILITY_READINESS_STATE_INVALID");
  }

  const missing = parseInputKeys(
    payload.missing,
    "PROFITABILITY_READINESS_INPUT_KEYS_INVALID",
  );
  const explicitZeroInputs = parseInputKeys(
    payload.explicitZeroInputs,
    "PROFITABILITY_READINESS_INPUT_KEYS_INVALID",
  );

  if (explicitZeroInputs.some((key) => missing.includes(key))) {
    throw new Error("PROFITABILITY_READINESS_INPUT_OVERLAP");
  }

  const ready = payload.status === "ready";
  if (
    payload.readyForFullProfitability !== ready ||
    (ready && missing.length !== 0) ||
    (!ready && missing.length === 0)
  ) {
    throw new Error("PROFITABILITY_READINESS_STATE_INCONSISTENT");
  }

  return {
    status: payload.status,
    readyForFullProfitability: payload.readyForFullProfitability,
    missing,
    explicitZeroInputs,
  };
}

export class HttpProfitabilityReadinessAdapter implements ProfitabilityReadinessPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/profitability/readiness",
    private readonly request: ReadinessFetch = (input, init) => fetch(input, init),
  ) {}

  async getReadiness(): Promise<ProfitabilityReadinessResponse | null> {
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
      return parseProfitabilityReadiness(await response.json());
    } catch {
      return null;
    }
  }
}

const LABELS: Record<ProfitabilityInputKey, string> = {
  grossMerchandiseValue: "GMV",
  vatRate: "USt.-Satz",
  refundsGross: "Retouren",
  discountsGross: "Rabatte",
  cogs: "COGS",
  fulfillmentCost: "Fulfillment",
  affiliateCommissionCost: "Creator-/Affiliate-Provision",
  paidMediaCost: "Paid Media",
  agencyFees: "Agenturkosten",
  paymentFees: "Payment Fees",
  platformFees: "Plattformgebühren",
  otherVariableCosts: "Sonstige variable Kosten",
};

function renderInputs(title: string, values: ProfitabilityInputKey[], className: string): string {
  if (!values.length) return "";
  return `<div class="${className}"><strong>${title}</strong><ul>${values.map((key) => `<li>${LABELS[key]}</li>`).join("")}</ul></div>`;
}

export function renderProfitabilityReadiness(
  response: ProfitabilityReadinessResponse | null,
): string {
  if (!response) {
    return `<section class="profit-readiness profit-readiness--empty"><span class="eyebrow">PROFITABILITY READINESS</span><h2>Datenstatus nicht verfügbar</h2><p>Es werden keine Profitabilitätswerte angezeigt, solange der serverseitige Input-Status nicht belastbar gelesen werden kann.</p></section>`;
  }

  const title = response.readyForFullProfitability
    ? "Inputs vollständig"
    : "Inputs unvollständig";
  const detail = response.readyForFullProfitability
    ? "Alle erforderlichen Inputs sind explizit vorhanden. Diese Ansicht berechnet weiterhin keinen Profit."
    : "Fehlende Inputs bleiben fehlend und werden nicht als 0 interpretiert.";

  const missing = renderInputs(
    "Fehlende Inputs",
    response.missing,
    "profit-readiness__inputs profit-readiness__inputs--missing",
  );
  const zeros = renderInputs(
    "Explizit als 0 erfasste Inputs",
    response.explicitZeroInputs,
    "profit-readiness__inputs profit-readiness__inputs--zero",
  );

  return `<section class="profit-readiness profit-readiness--${response.status}">
    <div class="profit-readiness__header">
      <div><span class="eyebrow">PROFITABILITY READINESS</span><h2>${title}</h2></div>
      <span class="profit-readiness__state">${response.readyForFullProfitability ? "READY" : "INCOMPLETE"}</span>
    </div>
    <p>${detail}</p>
    ${missing}
    ${zeros}
  </section>`;
}
