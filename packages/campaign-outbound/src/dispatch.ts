import { getCampaignActionQueue, markOutreachSent, type CampaignLedger } from "@gmvgang/campaign-operations";
import type {
  DispatchInitialOutreachInput,
  DispatchInitialOutreachResult,
  InitialOutreachDispatchRequest,
  OutreachTransportReceipt
} from "./types";

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
}

function timestamp(value: string, field: string): string {
  const normalized = required(value, field);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`${field} must be a valid timestamp`);
  return normalized;
}

function assignmentFor(ledger: CampaignLedger, creatorId: string) {
  const assignment = ledger.campaign.assignments.find((item) => item.creatorId === creatorId);
  if (!assignment) throw new Error(`creator is not assigned to campaign: ${creatorId}`);
  return assignment;
}

function initialOutreachKey(campaignId: string, creatorId: string): string {
  return `gmvgang:campaign:${campaignId}:creator:${creatorId}:outreach:initial:v1`;
}

function fingerprint(
  campaignId: string,
  brandId: string,
  productId: string,
  creatorId: string,
  templateId: string,
  templateVersion: string
): string {
  return ["outreach-v1", campaignId, brandId, productId, creatorId, templateId, templateVersion].join("|");
}

export function prepareInitialOutreachDispatch(
  input: Omit<DispatchInitialOutreachInput, "store" | "transport">
): InitialOutreachDispatchRequest {
  const creatorId = required(input.creatorId, "creatorId");
  const approvalId = required(input.approval.approvalId, "approval.approvalId");
  const approverId = required(input.approval.approverId, "approval.approverId");
  const approvedAt = timestamp(input.approval.approvedAt, "approval.approvedAt");
  const requestedAt = timestamp(input.requestedAt, "requestedAt");
  const templateId = required(input.template.templateId, "template.templateId");
  const templateVersion = required(input.template.version, "template.version");
  const { campaign } = input.ledger;

  if (campaign.status !== "active") throw new Error(`campaign must be active, current status: ${campaign.status}`);
  if (!campaign.readiness.ready) throw new Error("campaign readiness is not green");

  const assignment = assignmentFor(input.ledger, creatorId);
  if (!assignment.readiness.ready) throw new Error(`creator readiness is not green: ${creatorId}`);
  if (assignment.outreach.status !== "ready") {
    throw new Error(`initial outreach is not ready for creator ${creatorId}: ${assignment.outreach.status}`);
  }

  const action = getCampaignActionQueue(input.ledger, requestedAt).find(
    (candidate) => candidate.kind === "send-outreach" && candidate.creatorId === creatorId
  );
  if (!action) throw new Error(`send-outreach action is not available for creator: ${creatorId}`);
  if (!action.requiresApproval) throw new Error("send-outreach action must remain approval-gated");

  return {
    campaignId: campaign.id,
    brandId: campaign.brandId,
    productId: campaign.productId,
    creatorId,
    actionKind: "send-outreach",
    approval: { approvalId, approvedAt, approverId },
    template: { templateId, version: templateVersion },
    idempotencyKey: initialOutreachKey(campaign.id, creatorId),
    fingerprint: fingerprint(campaign.id, campaign.brandId, campaign.productId, creatorId, templateId, templateVersion),
    requestedAt
  };
}

function validateReceipt(receipt: OutreachTransportReceipt): OutreachTransportReceipt {
  return {
    provider: required(receipt.provider, "receipt.provider"),
    providerMessageId: required(receipt.providerMessageId, "receipt.providerMessageId"),
    sentAt: timestamp(receipt.sentAt, "receipt.sentAt")
  };
}

function reconcileSentLedger(
  ledger: CampaignLedger,
  creatorId: string,
  receipt: OutreachTransportReceipt
): CampaignLedger {
  const assignment = assignmentFor(ledger, creatorId);
  if (assignment.outreach.status === "ready") {
    return markOutreachSent(
      ledger,
      creatorId,
      { kind: "system", id: "campaign-outbound" },
      receipt.sentAt
    );
  }
  if (["sent", "replied", "accepted", "declined", "stopped"].includes(assignment.outreach.status)) return ledger;
  throw new Error(`cannot reconcile sent outreach from status: ${assignment.outreach.status}`);
}

function failureCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    const normalized = error.code.trim().slice(0, 80);
    if (normalized) return normalized;
  }
  return "dispatch_attempt_failed";
}

export async function dispatchApprovedInitialOutreach(
  input: DispatchInitialOutreachInput
): Promise<DispatchInitialOutreachResult> {
  const request = prepareInitialOutreachDispatch(input);
  const claim = await input.store.claim({
    key: request.idempotencyKey,
    fingerprint: request.fingerprint,
    campaignId: request.campaignId,
    creatorId: request.creatorId,
    approvalId: request.approval.approvalId,
    claimedAt: request.requestedAt
  });

  if (claim.status === "conflict") {
    throw new Error(`idempotency conflict for ${request.idempotencyKey}`);
  }
  if (claim.status === "in_flight" || claim.status === "uncertain") {
    return {
      status: "blocked",
      ledger: input.ledger,
      request,
      reason: claim.status
    };
  }
  if (claim.status === "sent") {
    if (!claim.record.receipt) throw new Error("sent idempotency record is missing its receipt");
    return {
      status: "duplicate",
      ledger: reconcileSentLedger(input.ledger, request.creatorId, claim.record.receipt),
      request,
      receipt: claim.record.receipt
    };
  }

  try {
    const receipt = validateReceipt(await input.transport.send(request));
    await input.store.complete(request.idempotencyKey, receipt, receipt.sentAt);
    return {
      status: "sent",
      ledger: reconcileSentLedger(input.ledger, request.creatorId, receipt),
      request,
      receipt
    };
  } catch (error) {
    const code = failureCode(error);
    try {
      await input.store.markUncertain(request.idempotencyKey, code, request.requestedAt);
    } catch {
      // The original atomic claim remains fail-closed even if the status update cannot be persisted.
    }
    return {
      status: "uncertain",
      ledger: input.ledger,
      request,
      failureCode: code
    };
  }
}
