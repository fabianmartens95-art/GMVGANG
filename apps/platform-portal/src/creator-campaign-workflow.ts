export type CreatorOutreachStatus =
  | "queued"
  | "ready"
  | "sent"
  | "replied"
  | "accepted"
  | "declined"
  | "stopped";

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

export type CreatorContentStatus =
  | "not_started"
  | "briefed"
  | "in_progress"
  | "posted"
  | "cancelled";

export type CreatorCampaignNextAction =
  | "review_campaign"
  | "await_outreach_result"
  | "await_sample"
  | "track_sample"
  | "review_brief"
  | "create_content"
  | "submit_content"
  | "campaign_complete"
  | "none";

export type CreatorCampaignWorkflowRow = {
  campaignId: string;
  campaignName: string;
  briefLabel: string | null;
  sampleRequired: boolean;
  outreachStatus: CreatorOutreachStatus;
  sampleStatus: CreatorSampleStatus;
  contentStatus: CreatorContentStatus;
  nextAction: CreatorCampaignNextAction;
};

export type CreatorCampaignWorkflowResponse = {
  campaigns: CreatorCampaignWorkflowRow[];
};

export interface CreatorCampaignWorkflowPort {
  getCampaigns(): Promise<CreatorCampaignWorkflowResponse | null>;
}

type WorkflowFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const OUTREACH = new Set<CreatorOutreachStatus>([
  "queued",
  "ready",
  "sent",
  "replied",
  "accepted",
  "declined",
  "stopped",
]);
const SAMPLES = new Set<CreatorSampleStatus>([
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
const CONTENT = new Set<CreatorContentStatus>([
  "not_started",
  "briefed",
  "in_progress",
  "posted",
  "cancelled",
]);
const ACTIONS = new Set<CreatorCampaignNextAction>([
  "review_campaign",
  "await_outreach_result",
  "await_sample",
  "track_sample",
  "review_brief",
  "create_content",
  "submit_content",
  "campaign_complete",
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

function optionalString(value: unknown, max: number, code: string): string | null {
  if (value === null) return null;
  return requiredString(value, max, code);
}

function expectedNextAction(row: {
  outreachStatus: CreatorOutreachStatus;
  sampleStatus: CreatorSampleStatus;
  contentStatus: CreatorContentStatus;
  sampleRequired: boolean;
}): CreatorCampaignNextAction {
  const { outreachStatus, sampleStatus, contentStatus, sampleRequired } = row;

  if (outreachStatus === "declined" || outreachStatus === "stopped") {
    return "campaign_complete";
  }

  if (outreachStatus !== "accepted") {
    if (sampleStatus !== "not_requested" || contentStatus !== "not_started") {
      return "none";
    }
    return outreachStatus === "sent" || outreachStatus === "replied"
      ? "review_campaign"
      : "await_outreach_result";
  }

  if (sampleRequired) {
    const beforeDelivery =
      sampleStatus === "not_requested" ||
      sampleStatus === "requested" ||
      sampleStatus === "approved" ||
      sampleStatus === "ordered" ||
      sampleStatus === "shipped";
    const prematureContent =
      contentStatus === "briefed" ||
      contentStatus === "in_progress" ||
      contentStatus === "posted";

    if (beforeDelivery && prematureContent) return "none";
    if (
      sampleStatus === "posted" &&
      contentStatus !== "posted" &&
      contentStatus !== "cancelled"
    ) {
      return "none";
    }

    if (
      sampleStatus === "not_requested" ||
      sampleStatus === "requested" ||
      sampleStatus === "approved"
    ) {
      return contentStatus === "cancelled" ? "campaign_complete" : "await_sample";
    }

    if (sampleStatus === "ordered" || sampleStatus === "shipped") {
      return contentStatus === "cancelled" ? "campaign_complete" : "track_sample";
    }

    if (sampleStatus === "rejected" || sampleStatus === "closed") {
      return "campaign_complete";
    }

    if (
      sampleStatus !== "delivered" &&
      sampleStatus !== "content_due" &&
      sampleStatus !== "posted"
    ) {
      return "none";
    }
  }

  if (contentStatus === "not_started") return "review_brief";
  if (contentStatus === "briefed") return "create_content";
  if (contentStatus === "in_progress") return "submit_content";
  return "campaign_complete";
}

export function parseCreatorCampaignWorkflow(
  payload: unknown,
): CreatorCampaignWorkflowResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["campaigns"]) ||
    !Array.isArray(payload.campaigns)
  ) {
    throw new Error("CREATOR_CAMPAIGN_WORKFLOW_PAYLOAD_INVALID");
  }

  const seen = new Set<string>();
  const campaigns = payload.campaigns.map((raw): CreatorCampaignWorkflowRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "campaignId",
        "campaignName",
        "briefLabel",
        "sampleRequired",
        "outreachStatus",
        "sampleStatus",
        "contentStatus",
        "nextAction",
      ])
    ) {
      throw new Error("CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID");
    }

    const campaignId = requiredString(
      raw.campaignId,
      128,
      "CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID",
    );
    if (seen.has(campaignId)) {
      throw new Error("CREATOR_CAMPAIGN_WORKFLOW_DUPLICATE_CAMPAIGN");
    }
    seen.add(campaignId);

    if (
      typeof raw.sampleRequired !== "boolean" ||
      typeof raw.outreachStatus !== "string" ||
      !OUTREACH.has(raw.outreachStatus as CreatorOutreachStatus) ||
      typeof raw.sampleStatus !== "string" ||
      !SAMPLES.has(raw.sampleStatus as CreatorSampleStatus) ||
      typeof raw.contentStatus !== "string" ||
      !CONTENT.has(raw.contentStatus as CreatorContentStatus) ||
      typeof raw.nextAction !== "string" ||
      !ACTIONS.has(raw.nextAction as CreatorCampaignNextAction)
    ) {
      throw new Error("CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID");
    }

    const row = {
      campaignId,
      campaignName: requiredString(
        raw.campaignName,
        256,
        "CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID",
      ),
      briefLabel: optionalString(
        raw.briefLabel,
        256,
        "CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID",
      ),
      sampleRequired: raw.sampleRequired,
      outreachStatus: raw.outreachStatus as CreatorOutreachStatus,
      sampleStatus: raw.sampleStatus as CreatorSampleStatus,
      contentStatus: raw.contentStatus as CreatorContentStatus,
      nextAction: raw.nextAction as CreatorCampaignNextAction,
    };

    if (row.nextAction !== expectedNextAction(row)) {
      throw new Error("CREATOR_CAMPAIGN_WORKFLOW_NEXT_ACTION_INCONSISTENT");
    }

    return row;
  });

  return { campaigns };
}

export class HttpCreatorCampaignWorkflowAdapter implements CreatorCampaignWorkflowPort {
  constructor(
    private readonly endpoint = "/api/creator/campaigns/workflow",
    private readonly request: WorkflowFetch = (input, init) => fetch(input, init),
  ) {}

  async getCampaigns(): Promise<CreatorCampaignWorkflowResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorCampaignWorkflow(await response.json());
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

const STATUS_LABELS = {
  queued: "Outreach geplant",
  ready: "Outreach bereit",
  sent: "Einladung gesendet",
  replied: "Antwort erhalten",
  accepted: "Campaign angenommen",
  declined: "Campaign abgelehnt",
  stopped: "Campaign gestoppt",
  not_requested: "Kein Sample angefragt",
  requested: "Sample angefragt",
  approved: "Sample freigegeben",
  rejected: "Sample abgelehnt",
  ordered: "Sample bestellt",
  shipped: "Sample versendet",
  delivered: "Sample zugestellt",
  content_due: "Content fällig",
  posted: "Veröffentlicht",
  closed: "Sample abgeschlossen",
  not_started: "Content offen",
  briefed: "Briefing erhalten",
  in_progress: "Content in Arbeit",
  cancelled: "Content beendet",
} as const;

const ACTION_LABELS: Record<CreatorCampaignNextAction, string> = {
  review_campaign: "Campaign prüfen",
  await_outreach_result: "Auf Campaign-Freigabe warten",
  await_sample: "Auf Sample warten",
  track_sample: "Sample verfolgen",
  review_brief: "Briefing prüfen",
  create_content: "Content erstellen",
  submit_content: "Content einreichen",
  campaign_complete: "Campaign abgeschlossen",
  none: "Keine sichere nächste Aktion",
};

export function renderCreatorCampaignWorkflow(
  response: CreatorCampaignWorkflowResponse | null,
): string {
  if (!response) {
    return `<section class="creator-campaign-workflow creator-campaign-workflow--empty"><span class="eyebrow">CAMPAIGNS</span><h2>Workflow nicht verfügbar</h2><p>Campaign-Status wird erst angezeigt, wenn der serverseitige Creator-Kontext belastbar gelesen werden kann.</p></section>`;
  }

  if (response.campaigns.length === 0) {
    return `<section class="creator-campaign-workflow creator-campaign-workflow--empty"><span class="eyebrow">CAMPAIGNS</span><h2>Keine aktiven Campaign-Workflows</h2><p>Sobald eine Creator-Campaign sichtbar ist, erscheint ihr Workflow hier.</p></section>`;
  }

  const cards = response.campaigns.map((campaign) => {
    const brief = campaign.briefLabel
      ? `<p class="creator-campaign-workflow__brief">${escapeHtml(campaign.briefLabel)}</p>`
      : "";
    return `<article class="creator-campaign-workflow__card">
      <div class="creator-campaign-workflow__card-header">
        <div><h3>${escapeHtml(campaign.campaignName)}</h3><p>${campaign.sampleRequired ? "Physisches Sample erforderlich" : "Kein physisches Sample erforderlich"}</p></div>
        <span class="creator-campaign-workflow__action">${escapeHtml(ACTION_LABELS[campaign.nextAction])}</span>
      </div>
      ${brief}
      <dl>
        <div><dt>Outreach</dt><dd>${escapeHtml(STATUS_LABELS[campaign.outreachStatus])}</dd></div>
        <div><dt>Sample</dt><dd>${escapeHtml(STATUS_LABELS[campaign.sampleStatus])}</dd></div>
        <div><dt>Content</dt><dd>${escapeHtml(STATUS_LABELS[campaign.contentStatus])}</dd></div>
      </dl>
    </article>`;
  }).join("");

  return `<section class="creator-campaign-workflow">
    <div class="creator-campaign-workflow__header"><div><span class="eyebrow">CAMPAIGNS</span><h2>Workflow-Status</h2><p>Die nächste Aktion wird serverseitig aus dem kanonischen Campaign-Workflow abgeleitet.</p></div><span>${response.campaigns.length} Campaign(s)</span></div>
    <div class="creator-campaign-workflow__list">${cards}</div>
  </section>`;
}
