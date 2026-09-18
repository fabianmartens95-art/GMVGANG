export type BrandCampaignStatus =
  | "draft"
  | "approved"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type BrandCampaignActionRequired =
  | "request_client_approval"
  | "launch_campaign"
  | "none";

export type BrandCampaignLifecycleRow = {
  campaignId: string;
  campaignName: string;
  status: BrandCampaignStatus;
  clientApproved: boolean;
  approvedAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  actionRequired: BrandCampaignActionRequired;
};

export type BrandCampaignLifecycleResponse = {
  campaigns: BrandCampaignLifecycleRow[];
};

export interface BrandCampaignLifecyclePort {
  getCampaigns(): Promise<BrandCampaignLifecycleResponse | null>;
}

type LifecycleFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const STATUSES = new Set<BrandCampaignStatus>([
  "draft",
  "approved",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

const ACTIONS = new Set<BrandCampaignActionRequired>([
  "request_client_approval",
  "launch_campaign",
  "none",
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

function nullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_CAMPAIGN_LIFECYCLE_TIMESTAMP_INVALID");
  }
  return value;
}

function expectedAction(
  status: BrandCampaignStatus,
  clientApproved: boolean,
): BrandCampaignActionRequired {
  if (status === "draft" && !clientApproved) return "request_client_approval";
  if (status === "approved") return "launch_campaign";
  return "none";
}

function assertLifecycleConsistency(row: {
  status: BrandCampaignStatus;
  clientApproved: boolean;
  approvedAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
}): void {
  const { status, clientApproved, approvedAt, launchedAt, completedAt } = row;

  if (status === "draft") {
    if (approvedAt !== null || launchedAt !== null || completedAt !== null) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "approved") {
    if (!clientApproved || approvedAt === null || launchedAt !== null || completedAt !== null) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "active" || status === "paused") {
    if (!clientApproved || approvedAt === null || launchedAt === null || completedAt !== null) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "completed") {
    if (
      !clientApproved ||
      approvedAt === null ||
      launchedAt === null ||
      completedAt === null
    ) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "cancelled" && completedAt !== null) {
    throw new Error("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");
  }
}

export function parseBrandCampaignLifecycle(
  payload: unknown,
): BrandCampaignLifecycleResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["campaigns"]) ||
    !Array.isArray(payload.campaigns)
  ) {
    throw new Error("BRAND_CAMPAIGN_LIFECYCLE_PAYLOAD_INVALID");
  }

  const seen = new Set<string>();
  const campaigns = payload.campaigns.map((raw): BrandCampaignLifecycleRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "campaignId",
        "campaignName",
        "status",
        "clientApproved",
        "approvedAt",
        "launchedAt",
        "completedAt",
        "actionRequired",
      ])
    ) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID");
    }

    const campaignId = requiredString(
      raw.campaignId,
      128,
      "BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID",
    );
    if (seen.has(campaignId)) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_DUPLICATE_CAMPAIGN");
    }
    seen.add(campaignId);

    if (
      typeof raw.status !== "string" ||
      !STATUSES.has(raw.status as BrandCampaignStatus) ||
      typeof raw.clientApproved !== "boolean" ||
      typeof raw.actionRequired !== "string" ||
      !ACTIONS.has(raw.actionRequired as BrandCampaignActionRequired)
    ) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID");
    }

    const row: BrandCampaignLifecycleRow = {
      campaignId,
      campaignName: requiredString(
        raw.campaignName,
        256,
        "BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID",
      ),
      status: raw.status as BrandCampaignStatus,
      clientApproved: raw.clientApproved,
      approvedAt: nullableTimestamp(raw.approvedAt),
      launchedAt: nullableTimestamp(raw.launchedAt),
      completedAt: nullableTimestamp(raw.completedAt),
      actionRequired: raw.actionRequired as BrandCampaignActionRequired,
    };

    assertLifecycleConsistency(row);

    if (row.actionRequired !== expectedAction(row.status, row.clientApproved)) {
      throw new Error("BRAND_CAMPAIGN_LIFECYCLE_ACTION_INCONSISTENT");
    }

    return row;
  });

  return { campaigns };
}

export class HttpBrandCampaignLifecycleAdapter implements BrandCampaignLifecyclePort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/campaigns/lifecycle",
    private readonly request: LifecycleFetch = (input, init) => fetch(input, init),
  ) {}

  async getCampaigns(): Promise<BrandCampaignLifecycleResponse | null> {
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
      return parseBrandCampaignLifecycle(await response.json());
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

const STATUS_LABELS: Record<BrandCampaignStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  active: "Aktiv",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

const ACTION_LABELS: Record<BrandCampaignActionRequired, string> = {
  request_client_approval: "Client-Freigabe erforderlich",
  launch_campaign: "Launch erforderlich",
  none: "Keine Lifecycle-Aktion erforderlich",
};

function formatTimestamp(value: string | null): string {
  return value ?? "—";
}

export function renderBrandCampaignLifecycle(
  response: BrandCampaignLifecycleResponse | null,
): string {
  if (!response) {
    return `<section class="brand-campaign-lifecycle brand-campaign-lifecycle--empty"><span class="eyebrow">CAMPAIGN LIFECYCLE</span><h2>Status nicht verfügbar</h2><p>Campaign-Lifecycle wird erst angezeigt, wenn der serverseitige Brand-Kontext belastbar gelesen werden kann.</p></section>`;
  }

  if (response.campaigns.length === 0) {
    return `<section class="brand-campaign-lifecycle brand-campaign-lifecycle--empty"><span class="eyebrow">CAMPAIGN LIFECYCLE</span><h2>Noch keine Campaigns</h2><p>Sobald Campaigns vorhanden sind, erscheint ihr serverseitiger Lifecycle-Status hier.</p></section>`;
  }

  const cards = response.campaigns.map((campaign) => `<article class="brand-campaign-lifecycle__card">
    <div class="brand-campaign-lifecycle__card-header">
      <div><span class="eyebrow">${escapeHtml(STATUS_LABELS[campaign.status])}</span><h3>${escapeHtml(campaign.campaignName)}</h3></div>
      <span class="brand-campaign-lifecycle__action">${escapeHtml(ACTION_LABELS[campaign.actionRequired])}</span>
    </div>
    <dl>
      <div><dt>Client Approved</dt><dd>${campaign.clientApproved ? "Ja" : "Nein"}</dd></div>
      <div><dt>Approved</dt><dd>${escapeHtml(formatTimestamp(campaign.approvedAt))}</dd></div>
      <div><dt>Launched</dt><dd>${escapeHtml(formatTimestamp(campaign.launchedAt))}</dd></div>
      <div><dt>Completed</dt><dd>${escapeHtml(formatTimestamp(campaign.completedAt))}</dd></div>
    </dl>
  </article>`).join("");

  const actionCount = response.campaigns.filter(
    (campaign) => campaign.actionRequired !== "none",
  ).length;

  return `<section class="brand-campaign-lifecycle">
    <div class="brand-campaign-lifecycle__header"><div><span class="eyebrow">CAMPAIGN LIFECYCLE</span><h2>Lifecycle & Action Required</h2><p>Die Ansicht ist read-only; Lifecycle-Mutationen bleiben serverautoritativ.</p></div><span>${actionCount} Aktion(en) offen</span></div>
    <div class="brand-campaign-lifecycle__list">${cards}</div>
  </section>`;
}
