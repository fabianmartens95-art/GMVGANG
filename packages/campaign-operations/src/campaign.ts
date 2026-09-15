import type { CreatorList } from "@gmvgang/creator-intelligence";
import { appendAuditEvent } from "./audit";
import type {
  AuditActor,
  CampaignCreatorAssignment,
  CampaignLedger,
  OutreachReply,
  SampleStatus
} from "./types";

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
}

function nonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`);
  return value;
}

function initialAssignment(creatorId: string): CampaignCreatorAssignment {
  return {
    creatorId,
    readiness: {
      contractReady: false,
      complianceReady: false,
      eligible: false,
      ready: false,
      blockers: ["Readiness not evaluated"]
    },
    outreach: {
      status: "queued",
      reply: null,
      sentAt: null,
      lastEventAt: null,
      nextFollowUpAt: null,
      followUpCount: 0
    },
    sample: {
      status: "not_requested",
      requestedAt: null,
      approvedAt: null,
      shippedAt: null,
      deliveredAt: null,
      lastEventAt: null,
      fulfillmentReference: null
    },
    content: {
      status: "not_started",
      briefedAt: null,
      postedAt: null,
      contentReference: null
    },
    performance: {
      gmV: 0,
      orders: 0,
      commission: 0,
      updatedAt: null
    }
  };
}

function assignmentIndex(ledger: CampaignLedger, creatorId: string): number {
  const index = ledger.campaign.assignments.findIndex((assignment) => assignment.creatorId === creatorId);
  if (index < 0) throw new Error(`creator is not assigned to campaign: ${creatorId}`);
  return index;
}

function updateAssignment(
  ledger: CampaignLedger,
  creatorId: string,
  update: (assignment: CampaignCreatorAssignment) => CampaignCreatorAssignment
): CampaignLedger {
  const index = assignmentIndex(ledger, creatorId);
  const current = ledger.campaign.assignments[index];
  if (!current) throw new Error(`creator assignment missing at index ${index}`);
  const assignments = [...ledger.campaign.assignments];
  assignments[index] = update(current);
  return {
    campaign: { ...ledger.campaign, assignments },
    auditTrail: ledger.auditTrail
  };
}

function readinessBlockers(ledger: CampaignLedger): string[] {
  const blockers = [...ledger.campaign.readiness.blockers];
  for (const assignment of ledger.campaign.assignments) {
    for (const blocker of assignment.readiness.blockers) blockers.push(`${assignment.creatorId}: ${blocker}`);
  }
  return blockers;
}

function requireCampaignReady(ledger: CampaignLedger): void {
  if (ledger.campaign.readiness.ready) return;
  const blockers = readinessBlockers(ledger);
  throw new Error(`campaign readiness blocked${blockers.length > 0 ? `: ${blockers.join("; ")}` : ""}`);
}

function requireCampaignActive(ledger: CampaignLedger): void {
  if (ledger.campaign.status !== "active") {
    throw new Error(`campaign must be active, current status: ${ledger.campaign.status}`);
  }
  requireCampaignReady(ledger);
}

export type CreateCampaignDraftInput = {
  id: string;
  name: string;
  brandId: string;
  productId: string;
  creatorList: CreatorList;
  createdAt: string;
  actor: AuditActor;
};

export function createCampaignDraft(input: CreateCampaignDraftInput): CampaignLedger {
  const id = required(input.id, "campaign.id");
  const name = required(input.name, "campaign.name");
  const brandId = required(input.brandId, "campaign.brandId");
  const productId = required(input.productId, "campaign.productId");
  const createdAt = required(input.createdAt, "campaign.createdAt");
  required(input.creatorList.id, "creatorList.id");

  if (input.creatorList.creatorIds.length === 0) throw new Error("creator list must contain at least one creator");
  const creatorIds = input.creatorList.creatorIds.map((creatorId) => required(creatorId, "creatorId"));
  if (new Set(creatorIds).size !== creatorIds.length) throw new Error("creator list contains duplicate creator ids");

  const base: CampaignLedger = {
    campaign: {
      id,
      name,
      brandId,
      productId,
      creatorListId: input.creatorList.id,
      status: "draft",
      readiness: {
        clientApproved: false,
        ready: false,
        evaluatedAt: null,
        blockers: ["Readiness not evaluated"]
      },
      createdAt,
      approvedAt: null,
      launchedAt: null,
      completedAt: null,
      assignments: creatorIds.map(initialAssignment)
    },
    auditTrail: []
  };

  return appendAuditEvent(base, {
    entityType: "campaign",
    entityId: id,
    action: "campaign.created",
    at: createdAt,
    actor: input.actor,
    details: { creatorListId: input.creatorList.id, creatorCount: creatorIds.length }
  });
}

export function approveCampaign(ledger: CampaignLedger, actor: AuditActor, at: string): CampaignLedger {
  if (ledger.campaign.status !== "draft") throw new Error("only draft campaigns can be approved");
  requireCampaignReady(ledger);
  const next: CampaignLedger = {
    campaign: { ...ledger.campaign, status: "approved", approvedAt: required(at, "approvedAt") },
    auditTrail: ledger.auditTrail
  };
  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.approved",
    at,
    actor,
    details: { readinessEvaluatedAt: ledger.campaign.readiness.evaluatedAt }
  });
}

export function launchCampaign(ledger: CampaignLedger, actor: AuditActor, at: string): CampaignLedger {
  if (ledger.campaign.status !== "approved") throw new Error("campaign must be approved before launch");
  requireCampaignReady(ledger);
  const launchedAt = required(at, "launchedAt");
  const assignments = ledger.campaign.assignments.map((assignment) => ({
    ...assignment,
    outreach: { ...assignment.outreach, status: "ready" as const, lastEventAt: launchedAt }
  }));
  const next: CampaignLedger = {
    campaign: { ...ledger.campaign, status: "active", launchedAt, assignments },
    auditTrail: ledger.auditTrail
  };
  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.launched",
    at: launchedAt,
    actor,
    details: { readyForOutreach: assignments.length }
  });
}

export function pauseCampaign(ledger: CampaignLedger, actor: AuditActor, at: string): CampaignLedger {
  requireCampaignActive(ledger);
  const next: CampaignLedger = {
    campaign: { ...ledger.campaign, status: "paused" },
    auditTrail: ledger.auditTrail
  };
  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.paused",
    at: required(at, "pausedAt"),
    actor
  });
}

export function resumeCampaign(ledger: CampaignLedger, actor: AuditActor, at: string): CampaignLedger {
  if (ledger.campaign.status !== "paused") throw new Error("only paused campaigns can be resumed");
  requireCampaignReady(ledger);
  const next: CampaignLedger = {
    campaign: { ...ledger.campaign, status: "active" },
    auditTrail: ledger.auditTrail
  };
  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.resumed",
    at: required(at, "resumedAt"),
    actor
  });
}

export function completeCampaign(ledger: CampaignLedger, actor: AuditActor, at: string): CampaignLedger {
  if (ledger.campaign.status !== "active" && ledger.campaign.status !== "paused") {
    throw new Error("only active or paused campaigns can be completed");
  }
  const completedAt = required(at, "completedAt");
  const next: CampaignLedger = {
    campaign: { ...ledger.campaign, status: "completed", completedAt },
    auditTrail: ledger.auditTrail
  };
  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.completed",
    at: completedAt,
    actor
  });
}

export function markOutreachSent(ledger: CampaignLedger, creatorId: string, actor: AuditActor, at: string): CampaignLedger {
  requireCampaignActive(ledger);
  const sentAt = required(at, "sentAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (assignment.outreach.status !== "ready") throw new Error("creator outreach is not ready to send");
    return {
      ...assignment,
      outreach: { ...assignment.outreach, status: "sent", sentAt, lastEventAt: sentAt }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "outreach.sent",
    at: sentAt,
    actor
  });
  return next;
}

export function scheduleFollowUp(
  ledger: CampaignLedger,
  creatorId: string,
  actor: AuditActor,
  at: string,
  followUpAt: string
): CampaignLedger {
  requireCampaignActive(ledger);
  const scheduledFor = required(followUpAt, "followUpAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (!["sent", "replied"].includes(assignment.outreach.status)) {
      throw new Error("follow-up can only be scheduled after outreach was sent");
    }
    return {
      ...assignment,
      outreach: { ...assignment.outreach, nextFollowUpAt: scheduledFor }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "outreach.followup_scheduled",
    at: required(at, "scheduledAt"),
    actor,
    details: { followUpAt: scheduledFor }
  });
  return next;
}

export function markFollowUpSent(ledger: CampaignLedger, creatorId: string, actor: AuditActor, at: string): CampaignLedger {
  requireCampaignActive(ledger);
  const sentAt = required(at, "followUpSentAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (!["sent", "replied"].includes(assignment.outreach.status)) throw new Error("creator is not eligible for follow-up");
    if (!assignment.outreach.nextFollowUpAt) throw new Error("no follow-up is scheduled for creator");
    return {
      ...assignment,
      outreach: {
        ...assignment.outreach,
        nextFollowUpAt: null,
        followUpCount: assignment.outreach.followUpCount + 1,
        lastEventAt: sentAt
      }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "outreach.followup_sent",
    at: sentAt,
    actor
  });
  return next;
}

export function recordOutreachReply(
  ledger: CampaignLedger,
  creatorId: string,
  reply: Exclude<OutreachReply, null>,
  actor: AuditActor,
  at: string
): CampaignLedger {
  requireCampaignActive(ledger);
  const replyAt = required(at, "replyAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (!["sent", "replied"].includes(assignment.outreach.status)) throw new Error("reply requires previously sent outreach");
    const status = reply === "accepted" ? "accepted" : reply === "declined" ? "declined" : "replied";
    return {
      ...assignment,
      outreach: {
        ...assignment.outreach,
        status,
        reply,
        lastEventAt: replyAt,
        nextFollowUpAt: reply === "question" ? assignment.outreach.nextFollowUpAt : null
      }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: `outreach.reply_${reply}`,
    at: replyAt,
    actor
  });
  return next;
}

export function requestSample(ledger: CampaignLedger, creatorId: string, actor: AuditActor, at: string): CampaignLedger {
  requireCampaignActive(ledger);
  const requestedAt = required(at, "sampleRequestedAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (assignment.outreach.status !== "accepted") throw new Error("sample request requires accepted creator outreach");
    if (assignment.sample.status !== "not_requested") throw new Error("sample has already entered the workflow");
    return {
      ...assignment,
      sample: { ...assignment.sample, status: "requested", requestedAt, lastEventAt: requestedAt }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "sample.requested",
    at: requestedAt,
    actor
  });
  return next;
}

const allowedSampleTransitions: Record<SampleStatus, SampleStatus[]> = {
  not_requested: ["requested"],
  requested: ["approved", "rejected"],
  approved: ["ordered"],
  rejected: ["closed"],
  ordered: ["shipped"],
  shipped: ["delivered"],
  delivered: ["content_due", "closed"],
  content_due: ["posted", "closed"],
  posted: ["closed"],
  closed: []
};

export function transitionSample(
  ledger: CampaignLedger,
  creatorId: string,
  status: SampleStatus,
  actor: AuditActor,
  at: string,
  fulfillmentReference: string | null = null
): CampaignLedger {
  requireCampaignActive(ledger);
  const eventAt = required(at, "sampleEventAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    const current = assignment.sample.status;
    if (!allowedSampleTransitions[current].includes(status)) {
      throw new Error(`invalid sample transition: ${current} -> ${status}`);
    }
    return {
      ...assignment,
      sample: {
        ...assignment.sample,
        status,
        approvedAt: status === "approved" ? eventAt : assignment.sample.approvedAt,
        shippedAt: status === "shipped" ? eventAt : assignment.sample.shippedAt,
        deliveredAt: status === "delivered" ? eventAt : assignment.sample.deliveredAt,
        lastEventAt: eventAt,
        fulfillmentReference: fulfillmentReference ?? assignment.sample.fulfillmentReference
      }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: `sample.${status}`,
    at: eventAt,
    actor,
    details: { fulfillmentReference }
  });
  return next;
}

export function briefCreator(ledger: CampaignLedger, creatorId: string, actor: AuditActor, at: string): CampaignLedger {
  requireCampaignActive(ledger);
  const briefedAt = required(at, "briefedAt");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (assignment.outreach.status !== "accepted") throw new Error("briefing requires accepted creator outreach");
    if (assignment.content.status !== "not_started") throw new Error("creator content has already started");
    return {
      ...assignment,
      content: { ...assignment.content, status: "briefed", briefedAt }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "content.briefed",
    at: briefedAt,
    actor
  });
  return next;
}

export function recordContentPosted(
  ledger: CampaignLedger,
  creatorId: string,
  actor: AuditActor,
  at: string,
  contentReference: string
): CampaignLedger {
  requireCampaignActive(ledger);
  const postedAt = required(at, "postedAt");
  const reference = required(contentReference, "contentReference");
  let next = updateAssignment(ledger, creatorId, (assignment) => {
    if (assignment.outreach.status !== "accepted") throw new Error("posted content requires accepted creator outreach");
    if (assignment.sample.status === "rejected") throw new Error("cannot post content from a rejected sample workflow");
    const sampleStatus = ["delivered", "content_due"].includes(assignment.sample.status)
      ? "posted" as const
      : assignment.sample.status;
    return {
      ...assignment,
      sample: { ...assignment.sample, status: sampleStatus, lastEventAt: postedAt },
      content: { ...assignment.content, status: "posted", postedAt, contentReference: reference }
    };
  });
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "content.posted",
    at: postedAt,
    actor,
    details: { contentReference: reference }
  });
  return next;
}

export function recordPerformanceSnapshot(
  ledger: CampaignLedger,
  creatorId: string,
  actor: AuditActor,
  at: string,
  metrics: { gmV: number; orders: number; commission: number }
): CampaignLedger {
  const updatedAt = required(at, "performanceUpdatedAt");
  const gmV = nonNegative(metrics.gmV, "performance.gmV");
  const orders = nonNegative(metrics.orders, "performance.orders");
  const commission = nonNegative(metrics.commission, "performance.commission");
  let next = updateAssignment(ledger, creatorId, (assignment) => ({
    ...assignment,
    performance: { gmV, orders, commission, updatedAt }
  }));
  next = appendAuditEvent(next, {
    entityType: "creator-assignment",
    entityId: creatorId,
    action: "performance.snapshot_recorded",
    at: updatedAt,
    actor,
    details: { gmV, orders, commission }
  });
  return next;
}
