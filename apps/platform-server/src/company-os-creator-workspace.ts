import type {
  CreatorWorkspaceSourceAssignment,
  CreatorWorkspaceSourcePort,
  CreatorWorkspaceSourceSnapshot,
} from "@gmvgang/platform-api";

export type CompanyOsSnapshotSource = "creators" | "campaigns" | "assignments";

const CREATOR_PROPERTIES = new Set([
  "Status",
  "Legal Hold",
  "Creator nicht aufnehmen",
  "Raus",
  "Compliance-Risiko",
  "TikTok Verstöße 90 Tage",
  "Compliance Check bestanden",
  "Vertrag unterschrieben am",
]);

const CAMPAIGN_PROPERTIES = new Set([
  "Campaign",
  "Campaign Key",
  "Status",
  "Client Approved",
  "Launched At",
  "Completed At",
]);

const ASSIGNMENT_PROPERTIES = new Set([
  "Creator",
  "Campaign",
  "Outreach Status",
  "Sample Status",
  "Content Status",
  "Posted At",
  "GMV",
  "Orders",
  "Commission",
]);

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

type Page = Record<string, unknown>;

type SnapshotStore = {
  creators: Page[] | null;
  campaigns: Page[] | null;
  assignments: Page[] | null;
  syncedAt: Record<CompanyOsSnapshotSource, string | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function notionRows(raw: unknown): Page[] {
  let rows: unknown;
  if (Array.isArray(raw)) rows = raw;
  else if (isRecord(raw) && Array.isArray(raw.results)) rows = raw.results;
  else if (isRecord(raw) && isRecord(raw.body) && Array.isArray(raw.body.results)) rows = raw.body.results;
  else if (isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.results)) rows = raw.data.results;
  else throw new Error("COMPANY_OS_SYNC_PAYLOAD_INVALID");

  return rows.map((row) => {
    if (!isRecord(row)) throw new Error("COMPANY_OS_SYNC_ROW_INVALID");
    if (typeof row.id !== "string" || !row.id.trim()) throw new Error("COMPANY_OS_SYNC_ROW_ID_REQUIRED");
    if (!isRecord(row.properties)) throw new Error("COMPANY_OS_SYNC_ROW_PROPERTIES_REQUIRED");
    return row;
  });
}

function sanitizeRows(raw: unknown, propertiesAllowed: ReadonlySet<string>): Page[] {
  return notionRows(raw).map((row) => {
    const properties: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(row.properties as Record<string, unknown>)) {
      if (propertiesAllowed.has(name)) properties[name] = value;
    }
    return {
      id: row.id,
      ...(typeof row.created_time === "string" ? { created_time: row.created_time } : {}),
      ...(typeof row.last_edited_time === "string" ? { last_edited_time: row.last_edited_time } : {}),
      properties,
    };
  });
}

function prop(page: Page, name: string): Record<string, unknown> | null {
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

function title(page: Page, name: string): string {
  return plainTextArray(prop(page, name)?.title);
}

function rich(page: Page, name: string): string {
  return plainTextArray(prop(page, name)?.rich_text);
}

function selected(page: Page, name: string): string | null {
  const select = prop(page, name)?.select;
  return isRecord(select) && typeof select.name === "string" ? select.name : null;
}

function checked(page: Page, name: string): boolean {
  return prop(page, name)?.checkbox === true;
}

function date(page: Page, name: string): string | null {
  const value = prop(page, name)?.date;
  return isRecord(value) && typeof value.start === "string" ? value.start : null;
}

function number(page: Page, name: string): number {
  const value = prop(page, name)?.number;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function relationId(page: Page, name: string): string | null {
  const relation = prop(page, name)?.relation;
  if (!Array.isArray(relation) || relation.length === 0 || !isRecord(relation[0])) return null;
  return typeof relation[0].id === "string" && relation[0].id.trim() ? relation[0].id : null;
}

function pageId(page: Page): string {
  return typeof page.id === "string" ? page.id : "";
}

function normalizedId(value: string): string {
  const cleaned = value.trim().replace(/-/g, "").toLowerCase();
  if (!/^[a-z0-9]{20,64}$/.test(cleaned)) throw new Error("COMPANY_OS_ENTITY_ID_INVALID");
  return cleaned;
}

function lastEditedAt(page: Page): string | null {
  return typeof page.last_edited_time === "string" ? page.last_edited_time : null;
}

function creatorReady(page: Page | undefined): boolean {
  if (!page) return false;
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

function coherentSyncedAt(values: readonly (string | null)[]): string | null {
  let oldest: string | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;
  for (const value of values) {
    if (!value) return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return null;
    if (ms < oldestMs) {
      oldest = value;
      oldestMs = ms;
    }
  }
  return oldest;
}

function propertiesForSource(source: CompanyOsSnapshotSource): ReadonlySet<string> {
  if (source === "creators") return CREATOR_PROPERTIES;
  if (source === "campaigns") return CAMPAIGN_PROPERTIES;
  return ASSIGNMENT_PROPERTIES;
}

export class CompanyOsCreatorWorkspaceReadPort implements CreatorWorkspaceSourcePort {
  private readonly store: SnapshotStore = {
    creators: null,
    campaigns: null,
    assignments: null,
    syncedAt: { creators: null, campaigns: null, assignments: null },
  };

  replaceSource(source: CompanyOsSnapshotSource, payload: unknown, syncedAt: string): { rows: number } {
    if (!Number.isFinite(Date.parse(syncedAt))) throw new Error("COMPANY_OS_SYNC_TIMESTAMP_INVALID");
    const rows = sanitizeRows(payload, propertiesForSource(source));
    this.store[source] = rows;
    this.store.syncedAt[source] = syncedAt;
    return { rows: rows.length };
  }

  sourceStatus(): {
    configuredSources: CompanyOsSnapshotSource[];
    syncedAt: Record<CompanyOsSnapshotSource, string | null>;
  } {
    const configuredSources = (["creators", "campaigns", "assignments"] as const)
      .filter((source) => this.store[source] !== null);
    return {
      configuredSources: [...configuredSources],
      syncedAt: { ...this.store.syncedAt },
    };
  }

  async readForCreator(input: { creatorMasterId: string; now: string }): Promise<CreatorWorkspaceSourceSnapshot> {
    const { creators, campaigns, assignments } = this.store;
    if (!creators || !campaigns || !assignments) {
      throw new Error("COMPANY_OS_CREATOR_WORKSPACE_SOURCE_NOT_READY");
    }

    const creatorId = normalizedId(input.creatorMasterId);
    const creator = creators.find((row) => normalizedId(pageId(row)) === creatorId);
    const isCreatorReady = creatorReady(creator);
    const campaignsByPageId = new Map(campaigns.map((campaign) => [normalizedId(pageId(campaign)), campaign]));
    const sourceAssignments: CreatorWorkspaceSourceAssignment[] = [];
    const seenCampaignIds = new Set<string>();

    for (const assignment of assignments) {
      const assignmentCreatorId = relationId(assignment, "Creator");
      if (!assignmentCreatorId || normalizedId(assignmentCreatorId) !== creatorId) continue;

      const campaignRelationId = relationId(assignment, "Campaign");
      if (!campaignRelationId) throw new Error("COMPANY_OS_CREATOR_WORKSPACE_CAMPAIGN_RELATION_REQUIRED");
      const campaign = campaignsByPageId.get(normalizedId(campaignRelationId));
      if (!campaign) throw new Error("COMPANY_OS_CREATOR_WORKSPACE_CAMPAIGN_MISSING");

      const campaignId = rich(campaign, "Campaign Key").trim() || pageId(campaign);
      if (seenCampaignIds.has(campaignId)) {
        throw new Error("COMPANY_OS_CREATOR_WORKSPACE_DUPLICATE_CAMPAIGN_ASSIGNMENT");
      }
      seenCampaignIds.add(campaignId);

      sourceAssignments.push({
        campaign: {
          id: campaignId,
          name: title(campaign, "Campaign").trim() || "Campaign",
          status: statusMap[selected(campaign, "Status") as keyof typeof statusMap] ?? "draft",
          clientApproved: checked(campaign, "Client Approved"),
          launchedAt: date(campaign, "Launched At"),
          completedAt: date(campaign, "Completed At"),
          updatedAt: lastEditedAt(campaign),
        },
        creatorReady: isCreatorReady,
        outreachStatus: outreachMap[selected(assignment, "Outreach Status") as keyof typeof outreachMap] ?? "stopped",
        sampleStatus: sampleMap[selected(assignment, "Sample Status") as keyof typeof sampleMap] ?? "not_requested",
        contentStatus: contentMap[selected(assignment, "Content Status") as keyof typeof contentMap] ?? "not_started",
        postedAt: date(assignment, "Posted At"),
        operationalPerformance: {
          gmV: number(assignment, "GMV"),
          orders: number(assignment, "Orders"),
          commission: number(assignment, "Commission"),
          updatedAt: lastEditedAt(assignment),
        },
      });
    }

    return {
      assignments: sourceAssignments,
      syncedAt: coherentSyncedAt([
        this.store.syncedAt.creators,
        this.store.syncedAt.campaigns,
        this.store.syncedAt.assignments,
      ]),
    };
  }
}
