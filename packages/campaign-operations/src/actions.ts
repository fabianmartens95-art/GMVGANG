import type { CampaignAction, CampaignLedger } from "./types";

function due(timestamp: string | null, now: number): boolean {
  if (!timestamp) return false;
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) throw new Error(`invalid action timestamp: ${timestamp}`);
  return value <= now;
}

export function getCampaignActionQueue(ledger: CampaignLedger, nowIso: string): CampaignAction[] {
  if (ledger.campaign.status !== "active") return [];
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) throw new Error(`invalid current timestamp: ${nowIso}`);

  const actions: CampaignAction[] = [];

  for (const assignment of ledger.campaign.assignments) {
    if (assignment.outreach.status === "ready") {
      actions.push({
        kind: "send-outreach",
        creatorId: assignment.creatorId,
        dueAt: ledger.campaign.launchedAt,
        requiresApproval: true,
        reason: "campaign launched and creator outreach is ready"
      });
    }

    if (
      ["sent", "replied"].includes(assignment.outreach.status) &&
      due(assignment.outreach.nextFollowUpAt, now)
    ) {
      actions.push({
        kind: "send-follow-up",
        creatorId: assignment.creatorId,
        dueAt: assignment.outreach.nextFollowUpAt,
        requiresApproval: true,
        reason: "scheduled creator follow-up is due"
      });
    }

    if (assignment.sample.status === "requested") {
      actions.push({
        kind: "approve-sample",
        creatorId: assignment.creatorId,
        dueAt: assignment.sample.requestedAt,
        requiresApproval: true,
        reason: "creator accepted and sample request awaits approval"
      });
    }

    if (assignment.sample.status === "approved") {
      actions.push({
        kind: "fulfill-sample",
        creatorId: assignment.creatorId,
        dueAt: assignment.sample.approvedAt,
        requiresApproval: true,
        reason: "approved sample awaits fulfillment"
      });
    }

    if (
      ["delivered", "content_due"].includes(assignment.sample.status) &&
      assignment.content.status !== "posted"
    ) {
      actions.push({
        kind: "content-reminder",
        creatorId: assignment.creatorId,
        dueAt: assignment.sample.deliveredAt,
        requiresApproval: true,
        reason: "sample delivered but creator content is not posted"
      });
    }
  }

  return actions.sort((a, b) => {
    const aTime = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.creatorId.localeCompare(b.creatorId) || a.kind.localeCompare(b.kind);
  });
}
