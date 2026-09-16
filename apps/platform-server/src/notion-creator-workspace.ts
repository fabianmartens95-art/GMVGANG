import type {
  CreatorWorkspaceSourceAssignment,
  CreatorWorkspaceSourcePort,
  CreatorWorkspaceSourceSnapshot,
} from "@gmvgang/platform-api";

const NOTION_API_VERSION = "2026-03-11";
const NOTION_API_ORIGIN = "https://api.notion.com";
const MAX_ASSIGNMENTS = 500;

const statusMap = {
  Draft: "draft",
  Approved: "approved",
  Active: "active",
  Paused: "paused",
  Completed: "completed",
  Cancelled: "cancelled",
} as const;

const outreachMap = {
  Queued: "queued",
  Ready: "ready",
  Sent: "sent",
  Replied: "replied",
  Accepted: "accepted",
  Declined: "declined",
  Stopped: "stopped",
} as const;

const sampleMap = {
  "Not Requested": "not_requested",
  Requested: "requested",
  Approved: "approved",
  Rejected: "rejected",
  Ordered: "ordered",
  Shipped: "shipped",
  Delivered: "delivered",
  "Content Due": "content_due",
  Posted: "posted",
  Closed: "closed",
} as const;

const contentMap = {
  "Not Started": "not_started",
  Briefed: "briefed",
  "In Progress": "in_progress",
  Posted: "posted",
  Cancelled: "cancelled",
} as const;

type NotionCreatorWorkspaceConfig = {
  token: string;
  assignmentDataSourceId: string;
};

type NotionHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type NotionWorkspaceFetch = (
  input: string,
  init: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<NotionHttpResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanNotionId(value: string, code: string): string {
  const cleaned = value.trim().replace(/^collection:\/\//, "");
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(cleaned)) throw new Error(code);
  return cleaned;
}

function prop(page: Record<string, unknown>, name: string): Record<string, unknown> | null {
  const properties = isRecord(page.properties) ? page.properties : null;
  const value = properties?.[name];
  return isRecord(value) ? value : null;
}

function plainTextArray(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (!isRecord(item)) return "";
    if (typeof item.plain_text === "string") return item.plain_text;
    if (isRecord(item.text) && typeof item.text.content === "string") return item.text.content;
    return "";
  }).join("");
}

function title(page: Record<string, unknown>, name: string): string {
  return plainTextArray(prop(page, name)?.title);
}

function rich(page: Record<string, unknown>, name: string): string {
  return plainTextArray(prop(page, name)?.rich_text);
}

function selected(page: Record<string, unknown>, name: string): string | null {
  const select = prop(page, name)?.select;
  return isRecord(select) && typeof select.name === "string" ? select.name : null;
}

function checked(page: Record<string, unknown>, name: string): boolean {
  return prop(page, name)?.checkbox === true;
}

function date(page: Record<string, unknown>, name: string): string | null {
  const value = prop(page, name)?.date;
  return isRecord(value) && typeof value.start === "string" ? value.start : null;
}

function number(page: Record<string, unknown>, name: string): number {
  const value = prop(page, name)?.number;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function relationId(page: Record<string, unknown>, name: string): string | null {
  const relation = prop(page, name)?.relation;
  if (!Array.isArray(relation) || relation.length === 0 || !isRecord(relation[0])) return null;
  return typeof relation[0].id === "string" && relation[0].id.trim() ? relation[0].id : null;
}

function pageId(page: Record<string, unknown>): string {
  if (typeof page.id !== "string" || !page.id.trim()) throw new Error("NOTION_CREATOR_WORKSPACE_PAGE_ID_REQUIRED");
  return page.id;
}

function lastEditedAt(page: Record<string, unknown>): string | null {
  return typeof page.last_edited_time === "string" ? page.last_edited_time : null;
}

function latestTimestamp(values: readonly (string | null)[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latest = value;
      latestMs = ms;
    }
  }
  return latest;
}

function creatorReady(page: Record<string, unknown>): boolean {
  const status = selected(page, "Status");
  const legalHold = checked(page, "Legal Hold");
  const manualExclusion = checked(page, "Creator nicht aufnehmen") || checked(page, "Raus");
  const complianceRisk = selected(page, "Compliance-Risiko") === "Blocker";
  const activeViolation = selected(page, "TikTok Verstöße 90 Tage") === "Ja – aktuell aktiv";
  const contractReady = Boolean(date(page, "Vertrag unterschrieben am"));
  const complianceReady = checked(page, "Compliance Check bestanden") && !legalHold && !complianceRisk && !activeViolation;
  const eligible = ["Onboarding", "Aktiv"].includes(status ?? "") && !legalHold && !manualExclusion && !activeViolation;
  return contractReady && complianceReady && eligible;
}

export class NotionCreatorWorkspaceReadPort implements CreatorWorkspaceSourcePort {
  private readonly token: string;
  private readonly assignmentDataSourceId: string;

  constructor(
    config: NotionCreatorWorkspaceConfig,
    private readonly notionFetch: NotionWorkspaceFetch = (input, init) => fetch(input, init),
  ) {
    this.token = config.token.trim();
    if (!this.token) throw new Error("NOTION_TOKEN_REQUIRED");
    this.assignmentDataSourceId = cleanNotionId(
      config.assignmentDataSourceId,
      "NOTION_ASSIGNMENT_DATA_SOURCE_ID_INVALID",
    );
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    };
  }

  private async fetchPage(id: string): Promise<Record<string, unknown>> {
    const cleanId = cleanNotionId(id, "NOTION_CREATOR_WORKSPACE_PAGE_ID_INVALID");
    const response = await this.notionFetch(`${NOTION_API_ORIGIN}/v1/pages/${encodeURIComponent(cleanId)}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) throw new Error(`NOTION_CREATOR_WORKSPACE_PAGE_READ_FAILED:${response.status}`);
    const payload = await response.json();
    if (!isRecord(payload)) throw new Error("NOTION_CREATOR_WORKSPACE_PAGE_RESPONSE_INVALID");
    return payload;
  }

  private async assignmentPages(creatorMasterId: string): Promise<Record<string, unknown>[]> {
    const creatorId = cleanNotionId(creatorMasterId, "NOTION_CREATOR_MASTER_ID_INVALID");
    const pages: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();
    let startCursor: string | undefined;

    while (true) {
      const response = await this.notionFetch(
        `${NOTION_API_ORIGIN}/v1/data_sources/${encodeURIComponent(this.assignmentDataSourceId)}/query`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            page_size: 100,
            filter: {
              property: "Creator",
              relation: { contains: creatorId },
            },
            ...(startCursor ? { start_cursor: startCursor } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error(`NOTION_CREATOR_ASSIGNMENT_QUERY_FAILED:${response.status}`);

      const payload = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.results)) {
        throw new Error("NOTION_CREATOR_ASSIGNMENT_QUERY_RESPONSE_INVALID");
      }
      for (const item of payload.results) {
        if (!isRecord(item)) throw new Error("NOTION_CREATOR_ASSIGNMENT_ROW_INVALID");
        const id = pageId(item);
        if (seenIds.has(id)) throw new Error("NOTION_CREATOR_ASSIGNMENT_DUPLICATE_PAGE");
        seenIds.add(id);
        pages.push(item);
        if (pages.length > MAX_ASSIGNMENTS) throw new Error("NOTION_CREATOR_ASSIGNMENT_CAP_EXCEEDED");
      }

      if (payload.has_more !== true) break;
      if (typeof payload.next_cursor !== "string" || !payload.next_cursor.trim()) {
        throw new Error("NOTION_CREATOR_ASSIGNMENT_CURSOR_MISSING");
      }
      startCursor = payload.next_cursor;
    }

    return pages;
  }

  async readForCreator(input: { creatorMasterId: string; now: string }): Promise<CreatorWorkspaceSourceSnapshot> {
    const creatorPage = await this.fetchPage(input.creatorMasterId);
    const isCreatorReady = creatorReady(creatorPage);
    const assignments = await this.assignmentPages(input.creatorMasterId);
    const campaignCache = new Map<string, Record<string, unknown>>();
    const sourceAssignments: CreatorWorkspaceSourceAssignment[] = [];
    const timestamps: (string | null)[] = [lastEditedAt(creatorPage)];

    for (const assignment of assignments) {
      const campaignPageId = relationId(assignment, "Campaign");
      if (!campaignPageId) throw new Error("NOTION_CREATOR_WORKSPACE_CAMPAIGN_RELATION_REQUIRED");
      let campaign = campaignCache.get(campaignPageId);
      if (!campaign) {
        campaign = await this.fetchPage(campaignPageId);
        campaignCache.set(campaignPageId, campaign);
      }

      const campaignStatus = statusMap[selected(campaign, "Status") as keyof typeof statusMap] ?? "draft";
      const outreachStatus = outreachMap[selected(assignment, "Outreach Status") as keyof typeof outreachMap] ?? "stopped";
      const sampleStatus = sampleMap[selected(assignment, "Sample Status") as keyof typeof sampleMap] ?? "not_requested";
      const contentStatus = contentMap[selected(assignment, "Content Status") as keyof typeof contentMap] ?? "not_started";
      const campaignUpdatedAt = lastEditedAt(campaign);
      const assignmentUpdatedAt = lastEditedAt(assignment);
      timestamps.push(campaignUpdatedAt, assignmentUpdatedAt);

      sourceAssignments.push({
        campaign: {
          id: rich(campaign, "Campaign Key").trim() || pageId(campaign),
          name: title(campaign, "Campaign").trim() || "Campaign",
          status: campaignStatus,
          clientApproved: checked(campaign, "Client Approved"),
          launchedAt: date(campaign, "Launched At"),
          completedAt: date(campaign, "Completed At"),
          updatedAt: campaignUpdatedAt,
        },
        creatorReady: isCreatorReady,
        outreachStatus,
        sampleStatus,
        contentStatus,
        postedAt: date(assignment, "Posted At"),
        operationalPerformance: {
          gmV: number(assignment, "GMV"),
          orders: number(assignment, "Orders"),
          commission: number(assignment, "Commission"),
          updatedAt: assignmentUpdatedAt,
        },
      });
    }

    return {
      assignments: sourceAssignments,
      syncedAt: latestTimestamp(timestamps),
    };
  }
}
