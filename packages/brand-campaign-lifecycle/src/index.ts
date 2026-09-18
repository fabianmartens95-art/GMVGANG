export type CampaignStatus =
  | "draft"
  | "approved"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type CampaignLifecycleState = {
  status: CampaignStatus;
  clientApproved: boolean;
  approvedAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
};

export type CampaignTransitionPlan =
  | {
      ok: true;
      next: CampaignLifecycleState;
      event:
        | "campaign.approved"
        | "campaign.returned_to_draft"
        | "campaign.launched"
        | "campaign.paused"
        | "campaign.resumed"
        | "campaign.completed"
        | "campaign.cancelled";
    }
  | {
      ok: false;
      error:
        | "CAMPAIGN_TRANSITION_DENIED"
        | "CAMPAIGN_CLIENT_APPROVAL_REQUIRED"
        | "CAMPAIGN_TIMESTAMP_INVALID";
    };

const ALLOWED_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["approved", "cancelled"],
  approved: ["draft", "active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function parseNow(now: string): string | null {
  const parsed = Date.parse(now);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function eventFor(from: CampaignStatus, to: CampaignStatus): CampaignTransitionPlan extends infer _T
  ? Exclude<CampaignTransitionPlan, { ok: false }>["event"]
  : never {
  if (to === "approved") return "campaign.approved";
  if (to === "draft") return "campaign.returned_to_draft";
  if (to === "active") return from === "paused" ? "campaign.resumed" : "campaign.launched";
  if (to === "paused") return "campaign.paused";
  if (to === "completed") return "campaign.completed";
  return "campaign.cancelled";
}

export function planCampaignTransition(input: {
  current: CampaignLifecycleState;
  target: CampaignStatus;
  now: string;
}): CampaignTransitionPlan {
  const now = parseNow(input.now);
  if (!now) return { ok: false, error: "CAMPAIGN_TIMESTAMP_INVALID" };

  const { current, target } = input;
  if (!ALLOWED_TRANSITIONS[current.status].includes(target)) {
    return { ok: false, error: "CAMPAIGN_TRANSITION_DENIED" };
  }

  if ((target === "approved" || target === "active") && !current.clientApproved) {
    return { ok: false, error: "CAMPAIGN_CLIENT_APPROVAL_REQUIRED" };
  }

  const next: CampaignLifecycleState = {
    ...current,
    status: target,
    approvedAt: current.approvedAt,
    launchedAt: current.launchedAt,
    completedAt: current.completedAt,
  };

  if (target === "approved") {
    next.approvedAt ??= now;
  }

  if (target === "draft") {
    next.approvedAt = null;
    next.launchedAt = null;
    next.completedAt = null;
  }

  if (target === "active") {
    next.launchedAt ??= now;
  }

  if (target === "completed") {
    next.completedAt ??= now;
  }

  return {
    ok: true,
    next,
    event: eventFor(current.status, target),
  };
}

export function campaignActionRequired(
  state: CampaignLifecycleState,
): "request_client_approval" | "launch_campaign" | "none" {
  if (state.status === "draft" && !state.clientApproved) {
    return "request_client_approval";
  }
  if (state.status === "approved") {
    return "launch_campaign";
  }
  return "none";
}
