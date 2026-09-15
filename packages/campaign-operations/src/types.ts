export type CampaignStatus = "draft" | "approved" | "active" | "paused" | "completed" | "cancelled";
export type OutreachStatus = "queued" | "ready" | "sent" | "replied" | "accepted" | "declined" | "stopped";
export type OutreachReply = "accepted" | "declined" | "question" | null;
export type SampleStatus = "not_requested" | "requested" | "approved" | "rejected" | "ordered" | "shipped" | "delivered" | "content_due" | "posted" | "closed";
export type ContentStatus = "not_started" | "briefed" | "in_progress" | "posted" | "cancelled";

export type CreatorOutreachState = {
  status: OutreachStatus;
  reply: OutreachReply;
  sentAt: string | null;
  lastEventAt: string | null;
  nextFollowUpAt: string | null;
  followUpCount: number;
};

export type CreatorSampleState = {
  status: SampleStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  lastEventAt: string | null;
  fulfillmentReference: string | null;
};

export type CreatorContentState = {
  status: ContentStatus;
  briefedAt: string | null;
  postedAt: string | null;
  contentReference: string | null;
};

export type CreatorCampaignPerformance = {
  gmV: number;
  orders: number;
  commission: number;
  updatedAt: string | null;
};

export type CampaignCreatorAssignment = {
  creatorId: string;
  outreach: CreatorOutreachState;
  sample: CreatorSampleState;
  content: CreatorContentState;
  performance: CreatorCampaignPerformance;
};

export type CampaignExecution = {
  id: string;
  name: string;
  brandId: string;
  productId: string;
  creatorListId: string;
  status: CampaignStatus;
  createdAt: string;
  approvedAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  assignments: CampaignCreatorAssignment[];
};

export type AuditActor = {
  kind: "human" | "system";
  id: string | null;
};

export type AuditDetails = Record<string, string | number | boolean | null>;

export type CampaignAuditEvent = {
  id: string;
  sequence: number;
  campaignId: string;
  entityType: "campaign" | "creator-assignment";
  entityId: string;
  action: string;
  at: string;
  actor: AuditActor;
  details: AuditDetails;
};

export type CampaignLedger = {
  campaign: CampaignExecution;
  auditTrail: CampaignAuditEvent[];
};

export type CampaignActionKind =
  | "send-outreach"
  | "send-follow-up"
  | "approve-sample"
  | "fulfill-sample"
  | "content-reminder";

export type CampaignAction = {
  kind: CampaignActionKind;
  creatorId: string;
  dueAt: string | null;
  requiresApproval: boolean;
  reason: string;
};

export type CampaignSummary = {
  totalCreators: number;
  outreachSent: number;
  replies: number;
  accepted: number;
  declined: number;
  samplesRequested: number;
  samplesDelivered: number;
  creatorsPosted: number;
  gmV: number;
  orders: number;
  commission: number;
  replyRate: number;
  acceptanceRate: number;
  sampleToPostRate: number;
};
