import { appendAuditEvent } from "./audit";
import type { AuditActor, CampaignLedger, CreatorCampaignReadiness } from "./types";

export type CreatorReadinessEvidence = {
  creatorId: string;
  contractReady: boolean;
  complianceReady: boolean;
  eligible: boolean;
};

export type CampaignReadinessEvidence = {
  clientApproved: boolean;
  creators: CreatorReadinessEvidence[];
};

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
}

function creatorReadiness(evidence: CreatorReadinessEvidence | undefined): CreatorCampaignReadiness {
  if (!evidence) {
    return {
      contractReady: false,
      complianceReady: false,
      eligible: false,
      ready: false,
      blockers: ["Readiness evidence missing"]
    };
  }

  const blockers: string[] = [];
  if (!evidence.contractReady) blockers.push("Creator contract not ready");
  if (!evidence.complianceReady) blockers.push("Creator compliance not ready");
  if (!evidence.eligible) blockers.push("Creator not eligible for campaign execution");

  return {
    contractReady: evidence.contractReady,
    complianceReady: evidence.complianceReady,
    eligible: evidence.eligible,
    ready: blockers.length === 0,
    blockers
  };
}

export function evaluateCampaignReadiness(
  ledger: CampaignLedger,
  evidence: CampaignReadinessEvidence,
  actor: AuditActor,
  at: string
): CampaignLedger {
  if (ledger.campaign.status !== "draft") throw new Error("readiness can only be evaluated for draft campaigns");
  const evaluatedAt = required(at, "readinessEvaluatedAt");

  const evidenceByCreator = new Map<string, CreatorReadinessEvidence>();
  for (const item of evidence.creators) {
    const creatorId = required(item.creatorId, "readiness.creatorId");
    if (evidenceByCreator.has(creatorId)) throw new Error(`duplicate readiness evidence for creator: ${creatorId}`);
    evidenceByCreator.set(creatorId, { ...item, creatorId });
  }

  const assignmentIds = new Set(ledger.campaign.assignments.map((assignment) => assignment.creatorId));
  for (const creatorId of evidenceByCreator.keys()) {
    if (!assignmentIds.has(creatorId)) throw new Error(`readiness evidence references unassigned creator: ${creatorId}`);
  }

  const assignments = ledger.campaign.assignments.map((assignment) => ({
    ...assignment,
    readiness: creatorReadiness(evidenceByCreator.get(assignment.creatorId))
  }));

  const campaignBlockers: string[] = [];
  if (!evidence.clientApproved) campaignBlockers.push("Client approval missing");
  if (assignments.length === 0) campaignBlockers.push("No creator assignments");

  const creatorsReady = assignments.filter((assignment) => assignment.readiness.ready).length;
  const ready = campaignBlockers.length === 0 && creatorsReady === assignments.length;

  const next: CampaignLedger = {
    campaign: {
      ...ledger.campaign,
      readiness: {
        clientApproved: evidence.clientApproved,
        ready,
        evaluatedAt,
        blockers: campaignBlockers
      },
      assignments
    },
    auditTrail: ledger.auditTrail
  };

  return appendAuditEvent(next, {
    entityType: "campaign",
    entityId: ledger.campaign.id,
    action: "campaign.readiness_evaluated",
    at: evaluatedAt,
    actor,
    details: {
      clientApproved: evidence.clientApproved,
      ready,
      creatorCount: assignments.length,
      creatorsReady,
      blockerCount: campaignBlockers.length + assignments.reduce((sum, assignment) => sum + assignment.readiness.blockers.length, 0)
    }
  });
}
