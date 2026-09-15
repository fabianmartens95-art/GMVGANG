import type { CampaignLedger, CampaignSummary } from "./types";

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function summarizeCampaign(ledger: CampaignLedger): CampaignSummary {
  const assignments = ledger.campaign.assignments;
  const outreachSent = assignments.filter((assignment) => assignment.outreach.sentAt !== null).length;
  const replies = assignments.filter((assignment) => assignment.outreach.reply !== null).length;
  const accepted = assignments.filter((assignment) => assignment.outreach.reply === "accepted").length;
  const declined = assignments.filter((assignment) => assignment.outreach.reply === "declined").length;
  const samplesRequested = assignments.filter((assignment) => assignment.sample.requestedAt !== null).length;
  const samplesDelivered = assignments.filter((assignment) => assignment.sample.deliveredAt !== null).length;
  const creatorsPosted = assignments.filter((assignment) => assignment.content.status === "posted").length;

  return {
    totalCreators: assignments.length,
    outreachSent,
    replies,
    accepted,
    declined,
    samplesRequested,
    samplesDelivered,
    creatorsPosted,
    gmV: assignments.reduce((sum, assignment) => sum + assignment.performance.gmV, 0),
    orders: assignments.reduce((sum, assignment) => sum + assignment.performance.orders, 0),
    commission: assignments.reduce((sum, assignment) => sum + assignment.performance.commission, 0),
    replyRate: rate(replies, outreachSent),
    acceptanceRate: rate(accepted, replies),
    sampleToPostRate: rate(creatorsPosted, samplesDelivered)
  };
}
