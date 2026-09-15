import type { AuditActor, AuditDetails, CampaignLedger } from "./types";

type AuditEventInput = {
  entityType: "campaign" | "creator-assignment";
  entityId: string;
  action: string;
  at: string;
  actor: AuditActor;
  details?: AuditDetails;
};

export function appendAuditEvent(ledger: CampaignLedger, input: AuditEventInput): CampaignLedger {
  if (!input.action.trim()) throw new Error("audit action must not be empty");
  if (!input.at.trim()) throw new Error("audit timestamp must not be empty");

  const sequence = ledger.auditTrail.length + 1;
  const event = {
    id: `${ledger.campaign.id}:${sequence}`,
    sequence,
    campaignId: ledger.campaign.id,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    at: input.at,
    actor: { ...input.actor },
    details: { ...(input.details ?? {}) }
  };

  return {
    campaign: ledger.campaign,
    auditTrail: [...ledger.auditTrail, event]
  };
}

export function validateAuditTrail(ledger: CampaignLedger): void {
  ledger.auditTrail.forEach((event, index) => {
    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) throw new Error(`audit sequence mismatch at ${event.id}`);
    if (event.campaignId !== ledger.campaign.id) throw new Error(`audit campaign mismatch at ${event.id}`);
    if (event.id !== `${ledger.campaign.id}:${expectedSequence}`) throw new Error(`audit id mismatch at sequence ${expectedSequence}`);
  });
}
