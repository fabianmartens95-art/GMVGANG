type CreatorMatchStatus = "new" | "contacted" | "awaiting_response";
type CampaignStatus = "draft" | "approved" | "active" | "paused" | "completed" | "cancelled";
type SampleStatus = "not_requested" | "requested" | "approved" | "rejected" | "ordered" | "shipped" | "delivered" | "content_due" | "posted" | "closed";
type ContentStatus = "not_started" | "briefed" | "in_progress" | "posted" | "cancelled";

type CreatorWorkspaceMatch = {
  campaignId: string;
  campaignName: string;
  status: CreatorMatchStatus;
};

type CreatorWorkspaceCampaign = {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  sampleStatus: SampleStatus;
  contentStatus: ContentStatus;
  launchedAt: string | null;
  completedAt: string | null;
  postedAt: string | null;
};

type CreatorWorkspacePerformanceCampaign = {
  campaignId: string;
  campaignName: string;
  gmV: number;
  orders: number;
  commission: number;
  updatedAt: string | null;
};

export type CreatorWorkspaceModel = {
  availability: "available" | "unavailable";
  generatedAt: string;
  syncedAt: string | null;
  unavailableReason?: "source_not_configured" | "creator_master_id_missing";
  matches: CreatorWorkspaceMatch[];
  campaigns: CreatorWorkspaceCampaign[];
  performance: {
    source: "company-os-operational";
    verification: "provisional";
    currency: null;
    totals: {
      gmV: number;
      orders: number;
      commission: number;
      postedContent: number;
    };
    campaigns: CreatorWorkspacePerformanceCampaign[];
    updatedAt: string | null;
  };
};

const MATCH_STATUSES = new Set<CreatorMatchStatus>(["new", "contacted", "awaiting_response"]);
const CAMPAIGN_STATUSES = new Set<CampaignStatus>(["draft", "approved", "active", "paused", "completed", "cancelled"]);
const SAMPLE_STATUSES = new Set<SampleStatus>([
  "not_requested", "requested", "approved", "rejected", "ordered", "shipped", "delivered", "content_due", "posted", "closed",
]);
const CONTENT_STATUSES = new Set<ContentStatus>(["not_started", "briefed", "in_progress", "posted", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function parseMatch(value: unknown): CreatorWorkspaceMatch | null {
  if (!isRecord(value)) return null;
  const campaignId = stringValue(value.campaignId);
  const campaignName = stringValue(value.campaignName);
  const status = stringValue(value.status);
  if (!campaignId || !campaignName || !status || !MATCH_STATUSES.has(status as CreatorMatchStatus)) return null;
  return { campaignId, campaignName, status: status as CreatorMatchStatus };
}

function parseCampaign(value: unknown): CreatorWorkspaceCampaign | null {
  if (!isRecord(value)) return null;
  const campaignId = stringValue(value.campaignId);
  const campaignName = stringValue(value.campaignName);
  const status = stringValue(value.status);
  const sampleStatus = stringValue(value.sampleStatus);
  const contentStatus = stringValue(value.contentStatus);
  const launchedAt = nullableString(value.launchedAt);
  const completedAt = nullableString(value.completedAt);
  const postedAt = nullableString(value.postedAt);
  if (
    !campaignId || !campaignName || !status || !CAMPAIGN_STATUSES.has(status as CampaignStatus) ||
    !sampleStatus || !SAMPLE_STATUSES.has(sampleStatus as SampleStatus) ||
    !contentStatus || !CONTENT_STATUSES.has(contentStatus as ContentStatus) ||
    launchedAt === undefined || completedAt === undefined || postedAt === undefined
  ) return null;
  return {
    campaignId,
    campaignName,
    status: status as CampaignStatus,
    sampleStatus: sampleStatus as SampleStatus,
    contentStatus: contentStatus as ContentStatus,
    launchedAt,
    completedAt,
    postedAt,
  };
}

function parsePerformanceCampaign(value: unknown): CreatorWorkspacePerformanceCampaign | null {
  if (!isRecord(value)) return null;
  const campaignId = stringValue(value.campaignId);
  const campaignName = stringValue(value.campaignName);
  const gmV = nonNegativeNumber(value.gmV);
  const orders = nonNegativeNumber(value.orders);
  const commission = nonNegativeNumber(value.commission);
  const updatedAt = nullableString(value.updatedAt);
  if (!campaignId || !campaignName || gmV === null || orders === null || commission === null || updatedAt === undefined) return null;
  return { campaignId, campaignName, gmV, orders, commission, updatedAt };
}

export function parseCreatorWorkspacePayload(payload: unknown): CreatorWorkspaceModel | null {
  if (!isRecord(payload) || !isRecord(payload.model)) return null;
  const model = payload.model;
  const availability = model.availability;
  if (availability !== "available" && availability !== "unavailable") return null;
  const generatedAt = stringValue(model.generatedAt);
  const syncedAt = nullableString(model.syncedAt);
  if (!generatedAt || syncedAt === undefined) return null;

  const unavailableReason = model.unavailableReason;
  if (
    unavailableReason !== undefined &&
    unavailableReason !== "source_not_configured" &&
    unavailableReason !== "creator_master_id_missing"
  ) return null;

  if (!Array.isArray(model.matches) || !Array.isArray(model.campaigns) || !isRecord(model.performance)) return null;
  const matches = model.matches.map(parseMatch);
  const campaigns = model.campaigns.map(parseCampaign);
  if (matches.some((item) => item === null) || campaigns.some((item) => item === null)) return null;

  const performance = model.performance;
  if (
    performance.source !== "company-os-operational" ||
    performance.verification !== "provisional" ||
    performance.currency !== null ||
    !isRecord(performance.totals) ||
    !Array.isArray(performance.campaigns)
  ) return null;
  const gmV = nonNegativeNumber(performance.totals.gmV);
  const orders = nonNegativeNumber(performance.totals.orders);
  const commission = nonNegativeNumber(performance.totals.commission);
  const postedContent = nonNegativeNumber(performance.totals.postedContent);
  const performanceUpdatedAt = nullableString(performance.updatedAt);
  const performanceCampaigns = performance.campaigns.map(parsePerformanceCampaign);
  if (
    gmV === null || orders === null || commission === null || postedContent === null || performanceUpdatedAt === undefined ||
    performanceCampaigns.some((item) => item === null)
  ) return null;

  return {
    availability,
    generatedAt,
    syncedAt,
    ...(unavailableReason ? { unavailableReason } : {}),
    matches: matches as CreatorWorkspaceMatch[],
    campaigns: campaigns as CreatorWorkspaceCampaign[],
    performance: {
      source: "company-os-operational",
      verification: "provisional",
      currency: null,
      totals: { gmV, orders, commission, postedContent },
      campaigns: performanceCampaigns as CreatorWorkspacePerformanceCampaign[],
      updatedAt: performanceUpdatedAt,
    },
  };
}

export class HttpCreatorWorkspaceAdapter {
  constructor(private readonly request: typeof fetch = fetch) {}

  async getWorkspace(): Promise<CreatorWorkspaceModel> {
    const response = await this.request("/api/creator/workspace", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`CREATOR_WORKSPACE_READ_FAILED:${response.status}`);
    const model = parseCreatorWorkspacePayload(await response.json());
    if (!model) throw new Error("CREATOR_WORKSPACE_RESPONSE_INVALID");
    return model;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

function unavailableMessage(model: CreatorWorkspaceModel): string {
  if (model.unavailableReason === "creator_master_id_missing") {
    return "Deine sichere Company-OS-Verknüpfung ist noch nicht vollständig. Matches und Campaign-Daten bleiben bis dahin ausgeblendet.";
  }
  return "Die operative Creator-Datenquelle ist für dieses Portal noch nicht aktiviert. Es werden keine Ersatz- oder Demo-Daten angezeigt.";
}

function unavailablePanel(model: CreatorWorkspaceModel): string {
  return `<section class="creator-workspace-empty creator-workspace-empty--unavailable">
    <span class="creator-workspace-kicker">DATENQUELLE NICHT VERFÜGBAR</span>
    <h2>Noch keine sichere Live-Ansicht</h2>
    <p>${escapeHtml(unavailableMessage(model))}</p>
  </section>`;
}

const matchLabels: Record<CreatorMatchStatus, string> = {
  new: "Neuer Match",
  contacted: "Kontakt gestartet",
  awaiting_response: "Antwort ausstehend",
};

const campaignLabels: Record<CampaignStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  active: "Aktiv",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  cancelled: "Beendet",
};

const sampleLabels: Record<SampleStatus, string> = {
  not_requested: "Noch nicht angefragt",
  requested: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  ordered: "Bestellt",
  shipped: "Versendet",
  delivered: "Geliefert",
  content_due: "Content fällig",
  posted: "Content gepostet",
  closed: "Abgeschlossen",
};

const contentLabels: Record<ContentStatus, string> = {
  not_started: "Noch nicht gestartet",
  briefed: "Briefing erhalten",
  in_progress: "In Arbeit",
  posted: "Gepostet",
  cancelled: "Beendet",
};

export function renderCreatorMatches(model: CreatorWorkspaceModel): string {
  if (model.availability === "unavailable") return unavailablePanel(model);
  if (model.matches.length === 0) {
    return `<section class="creator-workspace-empty">
      <span class="creator-workspace-kicker">MATCHING</span>
      <h2>Aktuell keine freigegebenen Matches</h2>
      <p>Hier erscheinen nur Campaigns, die von der Brand freigegeben wurden und für deinen aktuellen Creator-Status ausführbar sind.</p>
    </section>`;
  }
  return `<section class="creator-workspace-list" aria-label="Creator Matches">
    ${model.matches.map((match) => `<article class="creator-workspace-card">
      <span class="creator-workspace-kicker">${escapeHtml(matchLabels[match.status])}</span>
      <h2>${escapeHtml(match.campaignName)}</h2>
      <p>Dieser Match wurde serverseitig aus deinem verknüpften Creator-Datensatz abgeleitet. Interne Scores und andere Creator-Daten bleiben verborgen.</p>
    </article>`).join("")}
  </section>`;
}

export function renderCreatorCampaigns(model: CreatorWorkspaceModel): string {
  if (model.availability === "unavailable") return unavailablePanel(model);
  if (model.campaigns.length === 0) {
    return `<section class="creator-workspace-empty">
      <span class="creator-workspace-kicker">CAMPAIGNS</span>
      <h2>Noch keine aktive Teilnahme</h2>
      <p>Akzeptierte oder bereits gestartete Campaigns erscheinen hier als persönlicher Verlauf.</p>
    </section>`;
  }
  return `<section class="creator-workspace-list" aria-label="Creator Campaigns">
    ${model.campaigns.map((campaign) => `<article class="creator-workspace-card">
      <div class="creator-workspace-card__top">
        <span class="creator-workspace-kicker">${escapeHtml(campaignLabels[campaign.status])}</span>
        <span>${escapeHtml(contentLabels[campaign.contentStatus])}</span>
      </div>
      <h2>${escapeHtml(campaign.campaignName)}</h2>
      <dl class="creator-workspace-meta">
        <div><dt>Sample</dt><dd>${escapeHtml(sampleLabels[campaign.sampleStatus])}</dd></div>
        <div><dt>Content</dt><dd>${escapeHtml(contentLabels[campaign.contentStatus])}</dd></div>
        <div><dt>Start</dt><dd>${formatDate(campaign.launchedAt)}</dd></div>
        <div><dt>Post</dt><dd>${formatDate(campaign.postedAt)}</dd></div>
      </dl>
    </article>`).join("")}
  </section>`;
}

export function renderCreatorPerformance(model: CreatorWorkspaceModel): string {
  if (model.availability === "unavailable") return unavailablePanel(model);
  const performance = model.performance;
  return `<section class="creator-performance">
    <div class="creator-performance-warning" role="status">
      <strong>Operative Company-OS-Werte · provisional</strong>
      <span>Diese Zahlen sind noch nicht als TikTok-verifizierte Affiliate-Performance freigegeben. Deshalb wird keine Währung behauptet und keine verifizierte Auszahlung daraus abgeleitet.</span>
    </div>
    <div class="creator-performance-kpis">
      <article><span>GMV · operativ</span><strong>${formatNumber(performance.totals.gmV)}</strong></article>
      <article><span>Orders · operativ</span><strong>${formatNumber(performance.totals.orders)}</strong></article>
      <article><span>Commission · operativ</span><strong>${formatNumber(performance.totals.commission)}</strong></article>
      <article><span>Geposteter Content</span><strong>${formatNumber(performance.totals.postedContent)}</strong></article>
    </div>
    ${performance.campaigns.length === 0
      ? `<div class="creator-workspace-empty"><h2>Noch keine Performance-Daten</h2><p>Verifizierte Werte werden später getrennt angebunden; es werden keine Zahlen geschätzt.</p></div>`
      : `<div class="creator-performance-table" role="table" aria-label="Operative Campaign Performance">
          <div class="creator-performance-row creator-performance-row--head" role="row">
            <span>Campaign</span><span>GMV</span><span>Orders</span><span>Commission</span>
          </div>
          ${performance.campaigns.map((campaign) => `<div class="creator-performance-row" role="row">
            <strong>${escapeHtml(campaign.campaignName)}</strong>
            <span>${formatNumber(campaign.gmV)}</span>
            <span>${formatNumber(campaign.orders)}</span>
            <span>${formatNumber(campaign.commission)}</span>
          </div>`).join("")}
        </div>`}
    <p class="creator-workspace-source">Letzter operativer Stand: ${formatDate(performance.updatedAt ?? model.syncedAt)}</p>
  </section>`;
}
