export type CreatorSampleStatus =
  | "not_requested"
  | "requested"
  | "approved"
  | "rejected"
  | "ordered"
  | "shipped"
  | "delivered"
  | "content_due"
  | "posted"
  | "closed";

export type CreatorSampleTrackingRow = {
  campaignId: string;
  campaignName: string;
  status: CreatorSampleStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  lastEventAt: string | null;
  fulfillmentReference: string | null;
};

export type CreatorSampleTrackingResponse = {
  samples: CreatorSampleTrackingRow[];
};

export interface CreatorSampleTrackingPort {
  getSamples(): Promise<CreatorSampleTrackingResponse | null>;
}

type SampleFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const STATUSES = new Set<CreatorSampleStatus>([
  "not_requested",
  "requested",
  "approved",
  "rejected",
  "ordered",
  "shipped",
  "delivered",
  "content_due",
  "posted",
  "closed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function requiredText(
  value: unknown,
  maxLength: number,
  code: string,
): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(code);
  return cleaned;
}

function optionalText(
  value: unknown,
  maxLength: number,
  code: string,
): string | null {
  if (value === null) return null;
  return requiredText(value, maxLength, code);
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("CREATOR_SAMPLE_TRACKING_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

function assertChronology(
  values: readonly (string | null)[],
): void {
  let previous: number | null = null;
  for (const value of values) {
    if (value === null) continue;
    const current = Date.parse(value);
    if (previous !== null && current < previous) {
      throw new Error("CREATOR_SAMPLE_TRACKING_TIMESTAMP_INVALID");
    }
    previous = current;
  }
}

function assertStateConsistency(row: CreatorSampleTrackingRow): void {
  const {
    status,
    requestedAt,
    approvedAt,
    shippedAt,
    deliveredAt,
    lastEventAt,
    fulfillmentReference,
  } = row;

  assertChronology([requestedAt, approvedAt, shippedAt, deliveredAt]);
  const latestMilestone = [requestedAt, approvedAt, shippedAt, deliveredAt]
    .filter((value): value is string => value !== null)
    .map((value) => Date.parse(value))
    .reduce<number | null>(
      (latest, value) => latest === null || value > latest ? value : latest,
      null,
    );

  if (
    lastEventAt !== null &&
    latestMilestone !== null &&
    Date.parse(lastEventAt) < latestMilestone
  ) {
    throw new Error("CREATOR_SAMPLE_TRACKING_TIMESTAMP_INVALID");
  }

  if (status === "not_requested") {
    if (
      requestedAt !== null ||
      approvedAt !== null ||
      shippedAt !== null ||
      deliveredAt !== null ||
      lastEventAt !== null ||
      fulfillmentReference !== null
    ) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (requestedAt === null || lastEventAt === null) {
    throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
  }

  if (status === "requested") {
    if (approvedAt !== null || shippedAt !== null || deliveredAt !== null) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "rejected") {
    if (shippedAt !== null || deliveredAt !== null || fulfillmentReference !== null) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "approved" || status === "ordered") {
    if (approvedAt === null || shippedAt !== null || deliveredAt !== null) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "shipped") {
    if (approvedAt === null || shippedAt === null || deliveredAt !== null) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (
    status === "delivered" ||
    status === "content_due" ||
    status === "posted"
  ) {
    if (
      approvedAt === null ||
      shippedAt === null ||
      deliveredAt === null
    ) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "closed") {
    const rejectedPath =
      shippedAt === null &&
      deliveredAt === null &&
      fulfillmentReference === null;
    const fulfilledPath =
      approvedAt !== null &&
      shippedAt !== null &&
      deliveredAt !== null;
    if (!rejectedPath && !fulfilledPath) {
      throw new Error("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");
    }
  }
}

export function parseCreatorSampleTracking(
  payload: unknown,
): CreatorSampleTrackingResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["samples"]) ||
    !Array.isArray(payload.samples)
  ) {
    throw new Error("CREATOR_SAMPLE_TRACKING_PAYLOAD_INVALID");
  }

  const seen = new Set<string>();
  const samples = payload.samples.map((raw): CreatorSampleTrackingRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "campaignId",
        "campaignName",
        "status",
        "requestedAt",
        "approvedAt",
        "shippedAt",
        "deliveredAt",
        "lastEventAt",
        "fulfillmentReference",
      ]) ||
      typeof raw.status !== "string" ||
      !STATUSES.has(raw.status as CreatorSampleStatus)
    ) {
      throw new Error("CREATOR_SAMPLE_TRACKING_ROW_INVALID");
    }

    const campaignId = requiredText(
      raw.campaignId,
      128,
      "CREATOR_SAMPLE_TRACKING_ROW_INVALID",
    );
    if (seen.has(campaignId)) {
      throw new Error("CREATOR_SAMPLE_TRACKING_DUPLICATE_CAMPAIGN");
    }
    seen.add(campaignId);

    const row: CreatorSampleTrackingRow = {
      campaignId,
      campaignName: requiredText(
        raw.campaignName,
        256,
        "CREATOR_SAMPLE_TRACKING_ROW_INVALID",
      ),
      status: raw.status as CreatorSampleStatus,
      requestedAt: nullableTimestamp(raw.requestedAt),
      approvedAt: nullableTimestamp(raw.approvedAt),
      shippedAt: nullableTimestamp(raw.shippedAt),
      deliveredAt: nullableTimestamp(raw.deliveredAt),
      lastEventAt: nullableTimestamp(raw.lastEventAt),
      fulfillmentReference: optionalText(
        raw.fulfillmentReference,
        256,
        "CREATOR_SAMPLE_TRACKING_REFERENCE_INVALID",
      ),
    };

    assertStateConsistency(row);
    return row;
  });

  return { samples };
}

export class HttpCreatorSampleTrackingAdapter
implements CreatorSampleTrackingPort {
  constructor(
    private readonly endpoint = "/api/creator/samples",
    private readonly request: SampleFetch = (input, init) => fetch(input, init),
  ) {}

  async getSamples(): Promise<CreatorSampleTrackingResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorSampleTracking(await response.json());
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

const STATUS_LABELS: Record<CreatorSampleStatus, string> = {
  not_requested: "Noch nicht angefragt",
  requested: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  ordered: "Bestellt",
  shipped: "Versendet",
  delivered: "Zugestellt",
  content_due: "Content fällig",
  posted: "Content veröffentlicht",
  closed: "Abgeschlossen",
};

function timelineItem(label: string, value: string | null): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "—")}</dd></div>`;
}

export function renderCreatorSampleTracking(
  response: CreatorSampleTrackingResponse | null,
): string {
  if (!response) {
    return `<section class="creator-sample-tracking creator-sample-tracking--empty"><span class="eyebrow">SAMPLES</span><h2>Sample-Status nicht verfügbar</h2><p>Sample-Daten werden erst angezeigt, wenn sie deinem Creator-Account serverseitig sicher zugeordnet werden können.</p></section>`;
  }

  if (response.samples.length === 0) {
    return `<section class="creator-sample-tracking creator-sample-tracking--empty"><span class="eyebrow">SAMPLES</span><h2>Noch keine Samples</h2><p>Sobald eine Campaign einen Sample-Workflow startet, erscheint der Tracking-Status hier.</p></section>`;
  }

  const cards = response.samples.map((sample) => {
    const reference = sample.fulfillmentReference
      ? `<p class="creator-sample-tracking__reference">Fulfillment-Referenz: ${escapeHtml(sample.fulfillmentReference)}</p>`
      : "";
    return `<article class="creator-sample-tracking__card">
      <div class="creator-sample-tracking__card-header">
        <div><h3>${escapeHtml(sample.campaignName)}</h3><p>Read-only Sample-Tracking</p></div>
        <span class="creator-sample-tracking__status">${escapeHtml(STATUS_LABELS[sample.status])}</span>
      </div>
      <dl>
        ${timelineItem("Angefragt", sample.requestedAt)}
        ${timelineItem("Freigegeben", sample.approvedAt)}
        ${timelineItem("Versendet", sample.shippedAt)}
        ${timelineItem("Zugestellt", sample.deliveredAt)}
      </dl>
      ${reference}
    </article>`;
  }).join("");

  return `<section class="creator-sample-tracking">
    <div class="creator-sample-tracking__header"><div><span class="eyebrow">SAMPLES</span><h2>Sample-Tracking</h2><p>Versand- und Workflow-Status ohne Adress-, Kontakt- oder Zahlungsdaten.</p></div><span>${response.samples.length} Sample(s)</span></div>
    <div class="creator-sample-tracking__list">${cards}</div>
  </section>`;
}
