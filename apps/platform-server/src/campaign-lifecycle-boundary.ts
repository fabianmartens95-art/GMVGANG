import {
  planCampaignTransition,
  type CampaignLifecycleState,
  type CampaignStatus,
  type CampaignTransitionPlan,
} from "@gmvgang/brand-campaign-lifecycle";

export type PersistedCampaignLifecycle = {
  status: string;
  client_approved: boolean;
  approved_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
};

const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  "draft",
  "approved",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

function campaignStatus(value: string): CampaignStatus {
  if (!CAMPAIGN_STATUSES.has(value as CampaignStatus)) {
    throw new Error("CAMPAIGN_STATE_INVALID");
  }
  return value as CampaignStatus;
}

function validTimestamp(value: string | null): boolean {
  return value === null || Number.isFinite(Date.parse(value));
}

export function planPersistedCampaignTransition(input: {
  current: PersistedCampaignLifecycle;
  target: string;
  now: string;
}): CampaignTransitionPlan {
  const currentStatus = campaignStatus(input.current.status);
  const targetStatus = campaignStatus(input.target);
  if (
    !validTimestamp(input.current.approved_at) ||
    !validTimestamp(input.current.launched_at) ||
    !validTimestamp(input.current.completed_at)
  ) {
    throw new Error("CAMPAIGN_STATE_INVALID");
  }

  const current: CampaignLifecycleState = {
    status: currentStatus,
    clientApproved: input.current.client_approved,
    approvedAt: input.current.approved_at,
    launchedAt: input.current.launched_at,
    completedAt: input.current.completed_at,
  };

  return planCampaignTransition({ current, target: targetStatus, now: input.now });
}
