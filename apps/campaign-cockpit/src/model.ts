import {
  getCampaignActionQueue,
  summarizeCampaign,
  type CampaignAction,
  type CampaignLedger,
  type CampaignStatus,
  type CampaignSummary
} from "@gmvgang/campaign-operations";

export type CockpitHealth = "healthy" | "attention" | "blocked" | "complete";

export type CreatorCockpitRow = {
  creatorId: string;
  outreachStatus: string;
  sampleStatus: string;
  contentStatus: string;
  gmV: number;
  orders: number;
  commission: number;
  nextAction: CampaignAction | null;
  blocker: string | null;
};

export type CampaignCockpitView = {
  id: string;
  name: string;
  brandId: string;
  productId: string;
  status: CampaignStatus;
  health: CockpitHealth;
  summary: CampaignSummary;
  actions: CampaignAction[];
  approvalActions: number;
  blockers: string[];
  creators: CreatorCockpitRow[];
  auditEvents: number;
  lastAuditAt: string | null;
};

export type PortfolioCockpitView = {
  campaigns: CampaignCockpitView[];
  totalCampaigns: number;
  activeCampaigns: number;
  totalCreators: number;
  gmV: number;
  orders: number;
  commission: number;
  pendingActions: number;
  approvalActions: number;
  creatorsPosted: number;
  samplesDelivered: number;
  campaignsNeedingAttention: number;
};

function creatorBlocker(
  campaignStatus: CampaignStatus,
  assignment: CampaignLedger["campaign"]["assignments"][number]
): string | null {
  if (campaignStatus === "paused") return "Campaign paused";
  if (assignment.outreach.status === "accepted" && assignment.sample.status === "not_requested") {
    return "Sample request pending";
  }
  if (
    (assignment.sample.status === "delivered" || assignment.sample.status === "content_due") &&
    assignment.content.status !== "posted"
  ) {
    return "Content pending after delivery";
  }
  if (assignment.sample.status === "rejected") return "Sample rejected";
  return null;
}

function campaignHealth(status: CampaignStatus, blockerCount: number, actionCount: number): CockpitHealth {
  if (status === "completed") return "complete";
  if (status === "paused" || status === "cancelled") return "blocked";
  if (blockerCount > 0 || actionCount > 0 || status === "draft" || status === "approved") return "attention";
  return "healthy";
}

export function buildCampaignCockpitView(ledger: CampaignLedger, now: string): CampaignCockpitView {
  const summary = summarizeCampaign(ledger);
  const actions = getCampaignActionQueue(ledger, now);
  const firstActionByCreator = new Map<string, CampaignAction>();

  for (const action of actions) {
    if (!firstActionByCreator.has(action.creatorId)) firstActionByCreator.set(action.creatorId, action);
  }

  const creators = ledger.campaign.assignments.map((assignment): CreatorCockpitRow => ({
    creatorId: assignment.creatorId,
    outreachStatus: assignment.outreach.status,
    sampleStatus: assignment.sample.status,
    contentStatus: assignment.content.status,
    gmV: assignment.performance.gmV,
    orders: assignment.performance.orders,
    commission: assignment.performance.commission,
    nextAction: firstActionByCreator.get(assignment.creatorId) ?? null,
    blocker: creatorBlocker(ledger.campaign.status, assignment)
  }));

  const blockers = creators
    .filter((creator) => creator.blocker !== null)
    .map((creator) => `${creator.creatorId}: ${creator.blocker as string}`);

  return {
    id: ledger.campaign.id,
    name: ledger.campaign.name,
    brandId: ledger.campaign.brandId,
    productId: ledger.campaign.productId,
    status: ledger.campaign.status,
    health: campaignHealth(ledger.campaign.status, blockers.length, actions.length),
    summary,
    actions,
    approvalActions: actions.filter((action) => action.requiresApproval).length,
    blockers,
    creators,
    auditEvents: ledger.auditTrail.length,
    lastAuditAt: ledger.auditTrail.at(-1)?.at ?? null
  };
}

export function buildPortfolioCockpitView(ledgers: CampaignLedger[], now: string): PortfolioCockpitView {
  const campaigns = ledgers.map((ledger) => buildCampaignCockpitView(ledger, now));

  return {
    campaigns,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
    totalCreators: campaigns.reduce((sum, campaign) => sum + campaign.summary.totalCreators, 0),
    gmV: campaigns.reduce((sum, campaign) => sum + campaign.summary.gmV, 0),
    orders: campaigns.reduce((sum, campaign) => sum + campaign.summary.orders, 0),
    commission: campaigns.reduce((sum, campaign) => sum + campaign.summary.commission, 0),
    pendingActions: campaigns.reduce((sum, campaign) => sum + campaign.actions.length, 0),
    approvalActions: campaigns.reduce((sum, campaign) => sum + campaign.approvalActions, 0),
    creatorsPosted: campaigns.reduce((sum, campaign) => sum + campaign.summary.creatorsPosted, 0),
    samplesDelivered: campaigns.reduce((sum, campaign) => sum + campaign.summary.samplesDelivered, 0),
    campaignsNeedingAttention: campaigns.filter(
      (campaign) => campaign.health === "attention" || campaign.health === "blocked"
    ).length
  };
}
