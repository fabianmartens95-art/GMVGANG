export type OutreachStatus =
  | "queued"
  | "ready"
  | "sent"
  | "replied"
  | "accepted"
  | "declined"
  | "stopped";

export type SampleStatus =
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

export type ContentStatus =
  | "not_started"
  | "briefed"
  | "in_progress"
  | "posted"
  | "cancelled";

export type WorkflowTransitionDecision =
  | { ok: true }
  | { ok: false; error: "WORKFLOW_TRANSITION_DENIED" };

const OUTREACH_TRANSITIONS: Record<OutreachStatus, readonly OutreachStatus[]> = {
  queued: ["ready", "stopped"],
  ready: ["sent", "stopped"],
  sent: ["replied", "accepted", "declined", "stopped"],
  replied: ["accepted", "declined", "stopped"],
  accepted: ["stopped"],
  declined: [],
  stopped: [],
};

const SAMPLE_TRANSITIONS: Record<SampleStatus, readonly SampleStatus[]> = {
  not_requested: ["requested", "closed"],
  requested: ["approved", "rejected", "closed"],
  approved: ["ordered", "rejected", "closed"],
  rejected: ["closed"],
  ordered: ["shipped", "closed"],
  shipped: ["delivered", "closed"],
  delivered: ["content_due", "closed"],
  content_due: ["posted", "closed"],
  posted: ["closed"],
  closed: [],
};

const CONTENT_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  not_started: ["briefed", "cancelled"],
  briefed: ["in_progress", "cancelled"],
  in_progress: ["posted", "cancelled"],
  posted: [],
  cancelled: [],
};

function decide<T extends string>(
  current: T,
  target: T,
  transitions: Record<T, readonly T[]>,
): WorkflowTransitionDecision {
  return transitions[current].includes(target)
    ? { ok: true }
    : { ok: false, error: "WORKFLOW_TRANSITION_DENIED" };
}

export function authorizeOutreachTransition(
  current: OutreachStatus,
  target: OutreachStatus,
): WorkflowTransitionDecision {
  return decide(current, target, OUTREACH_TRANSITIONS);
}

export function authorizeSampleTransition(
  current: SampleStatus,
  target: SampleStatus,
): WorkflowTransitionDecision {
  return decide(current, target, SAMPLE_TRANSITIONS);
}

export function authorizeContentTransition(
  current: ContentStatus,
  target: ContentStatus,
): WorkflowTransitionDecision {
  return decide(current, target, CONTENT_TRANSITIONS);
}

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

const SAMPLE_BEFORE_DELIVERY = new Set<SampleStatus>([
  "not_requested",
  "requested",
  "approved",
  "ordered",
  "shipped",
]);

function hasPrematureContent(status: ContentStatus): boolean {
  return status === "briefed" || status === "in_progress" || status === "posted";
}

export function deriveCreatorCampaignNextAction(input: {
  outreachStatus: OutreachStatus;
  sampleStatus: SampleStatus;
  contentStatus: ContentStatus;
  sampleRequired: boolean;
}): CreatorCampaignNextAction {
  if (input.outreachStatus === "declined" || input.outreachStatus === "stopped") {
    return "campaign_complete";
  }

  if (input.outreachStatus !== "accepted") {
    if (
      input.sampleStatus !== "not_requested" ||
      input.contentStatus !== "not_started"
    ) {
      return "none";
    }
    if (input.outreachStatus === "sent" || input.outreachStatus === "replied") {
      return "review_campaign";
    }
    return "await_outreach_result";
  }

  if (input.sampleRequired) {
    if (
      SAMPLE_BEFORE_DELIVERY.has(input.sampleStatus) &&
      hasPrematureContent(input.contentStatus)
    ) {
      return "none";
    }
    if (
      input.sampleStatus === "posted" &&
      input.contentStatus !== "posted" &&
      input.contentStatus !== "cancelled"
    ) {
      return "none";
    }

    if (
      input.sampleStatus === "not_requested" ||
      input.sampleStatus === "requested" ||
      input.sampleStatus === "approved"
    ) {
      return input.contentStatus === "cancelled" ? "campaign_complete" : "await_sample";
    }

    if (input.sampleStatus === "ordered" || input.sampleStatus === "shipped") {
      return input.contentStatus === "cancelled" ? "campaign_complete" : "track_sample";
    }

    if (input.sampleStatus === "rejected" || input.sampleStatus === "closed") {
      return "campaign_complete";
    }

    if (
      input.sampleStatus !== "delivered" &&
      input.sampleStatus !== "content_due" &&
      input.sampleStatus !== "posted"
    ) {
      return "none";
    }
  }

  if (input.contentStatus === "not_started") return "review_brief";
  if (input.contentStatus === "briefed") return "create_content";
  if (input.contentStatus === "in_progress") return "submit_content";
  if (input.contentStatus === "posted") return "campaign_complete";
  if (input.contentStatus === "cancelled") return "campaign_complete";
  return "none";
}

export type SampleLifecyclePlan =
  | {
      ok: true;
      currentStatus: SampleStatus;
      targetStatus: SampleStatus;
      fulfillmentReference: string | null;
    }
  | {
      ok: false;
      error:
        | "SAMPLE_OUTREACH_NOT_ACCEPTED"
        | "SAMPLE_TRANSITION_DENIED"
        | "SAMPLE_FULFILLMENT_REFERENCE_REQUIRED"
        | "SAMPLE_FULFILLMENT_REFERENCE_INVALID";
    };

const SAMPLE_FULFILLMENT_REFERENCE_MAX = 256;
const SAMPLE_TRACKED_FULFILLMENT_STATES = new Set<SampleStatus>([
  "ordered",
  "shipped",
  "delivered",
]);

export function planSampleLifecycleTransition(input: {
  outreachStatus: OutreachStatus;
  currentStatus: SampleStatus;
  targetStatus: SampleStatus;
  fulfillmentReference?: string | null;
}): SampleLifecyclePlan {
  if (input.outreachStatus !== "accepted") {
    return { ok: false, error: "SAMPLE_OUTREACH_NOT_ACCEPTED" };
  }

  const transition = authorizeSampleTransition(input.currentStatus, input.targetStatus);
  if (!transition.ok) {
    return { ok: false, error: "SAMPLE_TRANSITION_DENIED" };
  }

  const fulfillmentReference = input.fulfillmentReference?.trim() || null;
  if (
    fulfillmentReference &&
    fulfillmentReference.length > SAMPLE_FULFILLMENT_REFERENCE_MAX
  ) {
    return { ok: false, error: "SAMPLE_FULFILLMENT_REFERENCE_INVALID" };
  }

  if (
    SAMPLE_TRACKED_FULFILLMENT_STATES.has(input.targetStatus) &&
    !fulfillmentReference
  ) {
    return { ok: false, error: "SAMPLE_FULFILLMENT_REFERENCE_REQUIRED" };
  }

  return {
    ok: true,
    currentStatus: input.currentStatus,
    targetStatus: input.targetStatus,
    fulfillmentReference,
  };
}
