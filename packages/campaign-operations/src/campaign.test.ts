import { describe, expect, it } from "vitest";
import type { CreatorList } from "@gmvgang/creator-intelligence";
import {
  approveCampaign,
  briefCreator,
  completeCampaign,
  createCampaignDraft,
  evaluateCampaignReadiness,
  getCampaignActionQueue,
  launchCampaign,
  markFollowUpSent,
  markOutreachSent,
  recordContentPosted,
  recordOutreachReply,
  recordPerformanceSnapshot,
  requestSample,
  scheduleFollowUp,
  summarizeCampaign,
  transitionSample,
  validateAuditTrail,
  type CampaignLedger
} from "./index";

const actor = { kind: "human" as const, id: "founder" };
const system = { kind: "system" as const, id: "campaign-engine" };

const creatorList: CreatorList = {
  id: "list-1",
  name: "Beauty shortlist",
  sourceSegmentId: "active-beauty-de",
  creatorIds: ["creator-1", "creator-2"],
  generatedAt: "2026-09-15T10:00:00.000Z"
};

function draft() {
  return createCampaignDraft({
    id: "campaign-1",
    name: "Beauty Launch",
    brandId: "brand-1",
    productId: "product-1",
    creatorList,
    createdAt: "2026-09-15T10:05:00.000Z",
    actor
  });
}

function ready(ledger: CampaignLedger, at = "2026-09-15T10:07:00.000Z"): CampaignLedger {
  return evaluateCampaignReadiness(
    ledger,
    {
      clientApproved: true,
      creators: ledger.campaign.assignments.map((assignment) => ({
        creatorId: assignment.creatorId,
        contractReady: true,
        complianceReady: true,
        eligible: true
      }))
    },
    actor,
    at
  );
}

describe("campaign execution core", () => {
  it("creates a draft from a materialized creator list with an unevaluated readiness gate", () => {
    const ledger = draft();

    expect(ledger.campaign.status).toBe("draft");
    expect(ledger.campaign.readiness.ready).toBe(false);
    expect(ledger.campaign.assignments.map((assignment) => assignment.creatorId)).toEqual([
      "creator-1",
      "creator-2"
    ]);
    expect(ledger.auditTrail).toHaveLength(1);
    expect(ledger.auditTrail[0]?.action).toBe("campaign.created");
    validateAuditTrail(ledger);
  });

  it("blocks approval until client and every creator readiness gate are green", () => {
    const created = draft();
    expect(() => approveCampaign(created, actor, "2026-09-15T10:08:00.000Z")).toThrow(
      "campaign readiness blocked"
    );

    const evaluated = evaluateCampaignReadiness(
      created,
      {
        clientApproved: false,
        creators: [
          { creatorId: "creator-1", contractReady: true, complianceReady: true, eligible: true },
          { creatorId: "creator-2", contractReady: false, complianceReady: true, eligible: false }
        ]
      },
      actor,
      "2026-09-15T10:07:00.000Z"
    );

    expect(evaluated.campaign.readiness.ready).toBe(false);
    expect(evaluated.campaign.readiness.blockers).toContain("Client approval missing");
    expect(evaluated.campaign.assignments[1]?.readiness.blockers).toEqual([
      "Creator contract not ready",
      "Creator not eligible for campaign execution"
    ]);
    expect(() => approveCampaign(evaluated, actor, "2026-09-15T10:08:00.000Z")).toThrow(
      "campaign readiness blocked"
    );
    expect(evaluated.auditTrail.at(-1)?.action).toBe("campaign.readiness_evaluated");
  });

  it("requires explicit readiness and approval before launch and exposes outreach as an approval-gated action", () => {
    const created = draft();
    expect(() => launchCampaign(created, actor, "2026-09-15T10:10:00.000Z")).toThrow(
      "campaign must be approved before launch"
    );

    const approved = approveCampaign(ready(created), actor, "2026-09-15T10:08:00.000Z");
    const launched = launchCampaign(approved, actor, "2026-09-15T10:10:00.000Z");
    const actions = getCampaignActionQueue(launched, "2026-09-15T10:11:00.000Z");

    expect(launched.campaign.status).toBe("active");
    expect(actions).toHaveLength(2);
    expect(actions.every((action) => action.kind === "send-outreach")).toBe(true);
    expect(actions.every((action) => action.requiresApproval)).toBe(true);
  });

  it("returns no external action queue when readiness is blocked even if an upstream status is active", () => {
    const blocked = evaluateCampaignReadiness(
      draft(),
      {
        clientApproved: false,
        creators: creatorList.creatorIds.map((creatorId) => ({
          creatorId,
          contractReady: false,
          complianceReady: true,
          eligible: false
        }))
      },
      actor,
      "2026-09-15T10:07:00.000Z"
    );
    const forgedActive: CampaignLedger = {
      ...blocked,
      campaign: { ...blocked.campaign, status: "active", launchedAt: "2026-09-15T10:10:00.000Z" }
    };

    expect(getCampaignActionQueue(forgedActive, "2026-09-15T10:11:00.000Z")).toEqual([]);
    expect(() => markOutreachSent(forgedActive, "creator-1", actor, "2026-09-15T10:12:00.000Z")).toThrow(
      "campaign readiness blocked"
    );
  });

  it("tracks outreach, follow-ups, replies and sample approval without sending anything automatically", () => {
    let ledger = launchCampaign(
      approveCampaign(ready(draft()), actor, "2026-09-15T10:08:00.000Z"),
      actor,
      "2026-09-15T10:10:00.000Z"
    );

    ledger = markOutreachSent(ledger, "creator-1", actor, "2026-09-15T10:15:00.000Z");
    ledger = scheduleFollowUp(
      ledger,
      "creator-1",
      system,
      "2026-09-15T10:16:00.000Z",
      "2026-09-17T10:15:00.000Z"
    );

    expect(getCampaignActionQueue(ledger, "2026-09-16T10:00:00.000Z").some((action) => action.kind === "send-follow-up")).toBe(false);
    expect(getCampaignActionQueue(ledger, "2026-09-17T10:16:00.000Z").some((action) => action.kind === "send-follow-up")).toBe(true);

    ledger = markFollowUpSent(ledger, "creator-1", actor, "2026-09-17T10:20:00.000Z");
    ledger = recordOutreachReply(ledger, "creator-1", "accepted", actor, "2026-09-17T11:00:00.000Z");
    ledger = requestSample(ledger, "creator-1", actor, "2026-09-17T11:05:00.000Z");

    const sampleAction = getCampaignActionQueue(ledger, "2026-09-17T11:06:00.000Z").find(
      (action) => action.creatorId === "creator-1" && action.kind === "approve-sample"
    );
    expect(sampleAction?.requiresApproval).toBe(true);
    expect(ledger.campaign.assignments[0]?.outreach.followUpCount).toBe(1);
  });

  it("enforces sample transitions and closes the loop through content and performance", () => {
    let ledger = launchCampaign(
      approveCampaign(ready(draft()), actor, "2026-09-15T10:08:00.000Z"),
      actor,
      "2026-09-15T10:10:00.000Z"
    );
    ledger = markOutreachSent(ledger, "creator-1", actor, "2026-09-15T10:15:00.000Z");
    ledger = recordOutreachReply(ledger, "creator-1", "accepted", actor, "2026-09-15T10:20:00.000Z");
    ledger = requestSample(ledger, "creator-1", actor, "2026-09-15T10:25:00.000Z");

    expect(() => transitionSample(ledger, "creator-1", "shipped", actor, "2026-09-15T10:30:00.000Z")).toThrow(
      "invalid sample transition"
    );

    ledger = transitionSample(ledger, "creator-1", "approved", actor, "2026-09-15T10:30:00.000Z");
    ledger = transitionSample(ledger, "creator-1", "ordered", actor, "2026-09-15T10:35:00.000Z", "order-123");
    ledger = transitionSample(ledger, "creator-1", "shipped", actor, "2026-09-16T08:00:00.000Z", "tracking-123");
    ledger = transitionSample(ledger, "creator-1", "delivered", system, "2026-09-17T08:00:00.000Z");
    ledger = transitionSample(ledger, "creator-1", "content_due", system, "2026-09-17T08:05:00.000Z");
    ledger = briefCreator(ledger, "creator-1", actor, "2026-09-17T08:10:00.000Z");
    ledger = recordContentPosted(
      ledger,
      "creator-1",
      actor,
      "2026-09-20T14:00:00.000Z",
      "tiktok-video-123"
    );
    ledger = recordPerformanceSnapshot(ledger, "creator-1", system, "2026-09-21T08:00:00.000Z", {
      gmV: 1250,
      orders: 42,
      commission: 187.5
    });

    const summary = summarizeCampaign(ledger);
    expect(summary.samplesDelivered).toBe(1);
    expect(summary.creatorsPosted).toBe(1);
    expect(summary.sampleToPostRate).toBe(100);
    expect(summary.gmV).toBe(1250);
    expect(summary.orders).toBe(42);
    expect(summary.commission).toBe(187.5);
    validateAuditTrail(ledger);
  });

  it("can complete an active campaign while preserving a valid audit trail", () => {
    const ledger = launchCampaign(
      approveCampaign(ready(draft()), actor, "2026-09-15T10:08:00.000Z"),
      actor,
      "2026-09-15T10:10:00.000Z"
    );
    const completed = completeCampaign(ledger, actor, "2026-09-30T18:00:00.000Z");

    expect(completed.campaign.status).toBe("completed");
    expect(completed.campaign.completedAt).toBe("2026-09-30T18:00:00.000Z");
    validateAuditTrail(completed);
  });
});
