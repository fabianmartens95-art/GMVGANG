import type { CreatorList } from "@gmvgang/creator-intelligence";
import {
  approveCampaign,
  briefCreator,
  createCampaignDraft,
  evaluateCampaignReadiness,
  launchCampaign,
  markOutreachSent,
  recordContentPosted,
  recordOutreachReply,
  recordPerformanceSnapshot,
  requestSample,
  scheduleFollowUp,
  transitionSample,
  type CampaignLedger
} from "@gmvgang/campaign-operations";

const founder = { kind: "human" as const, id: "founder" };
const system = { kind: "system" as const, id: "campaign-engine" };

function list(id: string, name: string, creatorIds: string[]): CreatorList {
  return {
    id,
    name,
    sourceSegmentId: `${id}-segment`,
    creatorIds,
    generatedAt: "2026-09-15T08:00:00.000Z"
  };
}

function ready(ledger: CampaignLedger, at: string): CampaignLedger {
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
    founder,
    at
  );
}

function buildBeautyLaunch(): CampaignLedger {
  let ledger = createCampaignDraft({
    id: "campaign-beauty-01",
    name: "Beauty Validation Sprint",
    brandId: "brand-kaell",
    productId: "product-hero-01",
    creatorList: list("beauty-shortlist", "Beauty DE Shortlist", ["creator-lena", "creator-nina", "creator-mia", "creator-zoe"]),
    createdAt: "2026-09-10T09:00:00.000Z",
    actor: founder
  });

  ledger = ready(ledger, "2026-09-10T09:10:00.000Z");
  ledger = approveCampaign(ledger, founder, "2026-09-10T09:15:00.000Z");
  ledger = launchCampaign(ledger, founder, "2026-09-10T09:30:00.000Z");

  ledger = markOutreachSent(ledger, "creator-lena", founder, "2026-09-10T10:00:00.000Z");
  ledger = scheduleFollowUp(
    ledger,
    "creator-lena",
    system,
    "2026-09-10T10:01:00.000Z",
    "2026-09-15T12:00:00.000Z"
  );

  ledger = markOutreachSent(ledger, "creator-nina", founder, "2026-09-10T10:05:00.000Z");
  ledger = recordOutreachReply(ledger, "creator-nina", "accepted", founder, "2026-09-10T13:00:00.000Z");
  ledger = requestSample(ledger, "creator-nina", founder, "2026-09-10T13:10:00.000Z");

  ledger = markOutreachSent(ledger, "creator-mia", founder, "2026-09-10T10:10:00.000Z");
  ledger = recordOutreachReply(ledger, "creator-mia", "accepted", founder, "2026-09-10T14:00:00.000Z");
  ledger = requestSample(ledger, "creator-mia", founder, "2026-09-10T14:10:00.000Z");
  ledger = transitionSample(ledger, "creator-mia", "approved", founder, "2026-09-10T14:20:00.000Z");
  ledger = transitionSample(ledger, "creator-mia", "ordered", founder, "2026-09-10T15:00:00.000Z", "sample-order-mia");
  ledger = transitionSample(ledger, "creator-mia", "shipped", founder, "2026-09-11T07:00:00.000Z", "tracking-mia");
  ledger = transitionSample(ledger, "creator-mia", "delivered", system, "2026-09-12T11:00:00.000Z");
  ledger = transitionSample(ledger, "creator-mia", "content_due", system, "2026-09-12T11:05:00.000Z");
  ledger = briefCreator(ledger, "creator-mia", founder, "2026-09-12T12:00:00.000Z");

  ledger = markOutreachSent(ledger, "creator-zoe", founder, "2026-09-10T10:15:00.000Z");
  ledger = recordOutreachReply(ledger, "creator-zoe", "accepted", founder, "2026-09-10T11:30:00.000Z");
  ledger = requestSample(ledger, "creator-zoe", founder, "2026-09-10T11:40:00.000Z");
  ledger = transitionSample(ledger, "creator-zoe", "approved", founder, "2026-09-10T11:50:00.000Z");
  ledger = transitionSample(ledger, "creator-zoe", "ordered", founder, "2026-09-10T12:00:00.000Z", "sample-order-zoe");
  ledger = transitionSample(ledger, "creator-zoe", "shipped", founder, "2026-09-11T06:30:00.000Z", "tracking-zoe");
  ledger = transitionSample(ledger, "creator-zoe", "delivered", system, "2026-09-12T09:00:00.000Z");
  ledger = transitionSample(ledger, "creator-zoe", "content_due", system, "2026-09-12T09:05:00.000Z");
  ledger = briefCreator(ledger, "creator-zoe", founder, "2026-09-12T09:20:00.000Z");
  ledger = recordContentPosted(ledger, "creator-zoe", founder, "2026-09-14T18:00:00.000Z", "tiktok-post-zoe-001");
  ledger = recordPerformanceSnapshot(ledger, "creator-zoe", system, "2026-09-15T08:00:00.000Z", {
    gmV: 1860,
    orders: 61,
    commission: 279
  });

  return ledger;
}

function buildHomeLaunchDraft(): CampaignLedger {
  return createCampaignDraft({
    id: "campaign-home-01",
    name: "Home & Living Test",
    brandId: "brand-demo-home",
    productId: "product-home-01",
    creatorList: list("home-shortlist", "Home DE Shortlist", ["creator-alex", "creator-felix", "creator-sara"]),
    createdAt: "2026-09-15T15:00:00.000Z",
    actor: founder
  });
}

export const demoNow = "2026-09-15T18:00:00.000Z";
export const demoLedgers: CampaignLedger[] = [buildBeautyLaunch(), buildHomeLaunchDraft()];
