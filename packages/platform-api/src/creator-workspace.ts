import type {
  CreatorWorkspaceCampaign,
  CreatorWorkspaceMatch,
  CreatorWorkspacePerformance,
  CreatorWorkspaceReadModel,
  CreatorWorkspaceSourceSnapshot,
} from "./types.js";

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

function isParticipating(assignment: CreatorWorkspaceSourceSnapshot["assignments"][number]): boolean {
  return assignment.outreachStatus === "accepted" ||
    assignment.sampleStatus !== "not_requested" ||
    assignment.contentStatus !== "not_started";
}

function matchStatus(
  outreachStatus: CreatorWorkspaceSourceSnapshot["assignments"][number]["outreachStatus"],
): CreatorWorkspaceMatch["status"] | null {
  if (outreachStatus === "queued" || outreachStatus === "ready") return "new";
  if (outreachStatus === "sent") return "contacted";
  if (outreachStatus === "replied") return "awaiting_response";
  return null;
}

export function unavailableCreatorWorkspaceReadModel(
  generatedAt: string,
  unavailableReason: NonNullable<CreatorWorkspaceReadModel["unavailableReason"]>,
): CreatorWorkspaceReadModel {
  return {
    availability: "unavailable",
    unavailableReason,
    generatedAt,
    syncedAt: null,
    matches: [],
    campaigns: [],
    performance: {
      source: "company-os-operational",
      verification: "provisional",
      currency: null,
      totals: { gmV: 0, orders: 0, commission: 0, postedContent: 0 },
      campaigns: [],
      updatedAt: null,
    },
  };
}

export function buildCreatorWorkspaceReadModel(
  source: CreatorWorkspaceSourceSnapshot,
  generatedAt: string,
): CreatorWorkspaceReadModel {
  const seenCampaignIds = new Set<string>();
  const matches: CreatorWorkspaceMatch[] = [];
  const campaigns: CreatorWorkspaceCampaign[] = [];
  const performanceCampaigns: CreatorWorkspacePerformance["campaigns"] = [];

  for (const assignment of source.assignments) {
    const campaignId = assignment.campaign.id.trim();
    const campaignName = assignment.campaign.name.trim();
    if (!campaignId || !campaignName) throw new Error("CREATOR_WORKSPACE_CAMPAIGN_IDENTITY_REQUIRED");
    if (seenCampaignIds.has(campaignId)) throw new Error("CREATOR_WORKSPACE_DUPLICATE_CAMPAIGN_ASSIGNMENT");
    seenCampaignIds.add(campaignId);

    if (!assignment.campaign.clientApproved || assignment.campaign.status === "draft") continue;

    if (isParticipating(assignment)) {
      campaigns.push({
        campaignId,
        campaignName,
        status: assignment.campaign.status,
        sampleStatus: assignment.sampleStatus,
        contentStatus: assignment.contentStatus,
        launchedAt: assignment.campaign.launchedAt,
        completedAt: assignment.campaign.completedAt,
        postedAt: assignment.postedAt,
      });
      performanceCampaigns.push({
        campaignId,
        campaignName,
        gmV: assignment.operationalPerformance.gmV,
        orders: assignment.operationalPerformance.orders,
        commission: assignment.operationalPerformance.commission,
        updatedAt: assignment.operationalPerformance.updatedAt,
      });
      continue;
    }

    if (!assignment.creatorReady) continue;
    if (assignment.campaign.status !== "approved" && assignment.campaign.status !== "active") continue;
    const status = matchStatus(assignment.outreachStatus);
    if (!status) continue;
    matches.push({ campaignId, campaignName, status });
  }

  matches.sort((left, right) => left.campaignName.localeCompare(right.campaignName));
  campaigns.sort((left, right) => {
    const leftTime = Date.parse(left.launchedAt ?? left.completedAt ?? "") || 0;
    const rightTime = Date.parse(right.launchedAt ?? right.completedAt ?? "") || 0;
    return rightTime - leftTime || left.campaignName.localeCompare(right.campaignName);
  });
  performanceCampaigns.sort((left, right) => left.campaignName.localeCompare(right.campaignName));

  const performance: CreatorWorkspacePerformance = {
    source: "company-os-operational",
    verification: "provisional",
    currency: null,
    totals: {
      gmV: performanceCampaigns.reduce((sum, item) => sum + item.gmV, 0),
      orders: performanceCampaigns.reduce((sum, item) => sum + item.orders, 0),
      commission: performanceCampaigns.reduce((sum, item) => sum + item.commission, 0),
      postedContent: campaigns.filter((campaign) => campaign.contentStatus === "posted").length,
    },
    campaigns: performanceCampaigns,
    updatedAt: latestTimestamp(performanceCampaigns.map((item) => item.updatedAt)),
  };

  return {
    availability: "available",
    generatedAt,
    syncedAt: source.syncedAt,
    matches,
    campaigns,
    performance,
  };
}
