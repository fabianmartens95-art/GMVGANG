import { describe, expect, it } from "vitest";

import {
  authorizeContentTransition,
  authorizeOutreachTransition,
  authorizeSampleTransition,
  deriveCreatorCampaignNextAction,
  planSampleLifecycleTransition,
} from "./index.js";

describe("Creator Campaign workflow transitions", () => {
  it("enforces Outreach progression and terminal states", () => {
    expect(authorizeOutreachTransition("queued", "ready")).toEqual({ ok: true });
    expect(authorizeOutreachTransition("ready", "sent")).toEqual({ ok: true });
    expect(authorizeOutreachTransition("sent", "accepted")).toEqual({ ok: true });
    expect(authorizeOutreachTransition("declined", "sent")).toEqual({
      ok: false,
      error: "WORKFLOW_TRANSITION_DENIED",
    });
  });

  it("prevents Sample lifecycle jumps", () => {
    expect(authorizeSampleTransition("requested", "approved")).toEqual({ ok: true });
    expect(authorizeSampleTransition("approved", "ordered")).toEqual({ ok: true });
    expect(authorizeSampleTransition("ordered", "shipped")).toEqual({ ok: true });
    expect(authorizeSampleTransition("requested", "delivered")).toEqual({
      ok: false,
      error: "WORKFLOW_TRANSITION_DENIED",
    });
    expect(authorizeSampleTransition("closed", "requested")).toEqual({
      ok: false,
      error: "WORKFLOW_TRANSITION_DENIED",
    });
  });

  it("prevents Content from jumping directly to posted", () => {
    expect(authorizeContentTransition("not_started", "briefed")).toEqual({ ok: true });
    expect(authorizeContentTransition("briefed", "in_progress")).toEqual({ ok: true });
    expect(authorizeContentTransition("in_progress", "posted")).toEqual({ ok: true });
    expect(authorizeContentTransition("not_started", "posted")).toEqual({
      ok: false,
      error: "WORKFLOW_TRANSITION_DENIED",
    });
  });
});

describe("Creator Campaign next action", () => {
  it("keeps pre-acceptance work in opportunity/outreach state", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "sent",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("review_campaign");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "queued",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("await_outreach_result");
  });

  it("fails closed when downstream work appears before Outreach acceptance", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "sent",
      sampleStatus: "requested",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("none");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "ready",
      sampleStatus: "not_requested",
      contentStatus: "briefed",
      sampleRequired: false,
    })).toBe("none");
  });

  it("guides accepted sampled campaigns through sample fulfillment first", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "requested",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("await_sample");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "shipped",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("track_sample");
  });

  it("fails closed on content that progressed before a required Sample is delivered", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "requested",
      contentStatus: "posted",
      sampleRequired: true,
    })).toBe("none");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "shipped",
      contentStatus: "in_progress",
      sampleRequired: true,
    })).toBe("none");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "posted",
      contentStatus: "briefed",
      sampleRequired: true,
    })).toBe("none");
  });

  it("moves into briefing/content after sample delivery", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "delivered",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("review_brief");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "content_due",
      contentStatus: "briefed",
      sampleRequired: true,
    })).toBe("create_content");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "content_due",
      contentStatus: "in_progress",
      sampleRequired: true,
    })).toBe("submit_content");
  });

  it("supports campaigns without a physical sample", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "not_requested",
      contentStatus: "briefed",
      sampleRequired: false,
    })).toBe("create_content");
  });

  it("treats declined, stopped, rejected/closed sample and terminal content as complete", () => {
    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "declined",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("campaign_complete");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "rejected",
      contentStatus: "not_started",
      sampleRequired: true,
    })).toBe("campaign_complete");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "posted",
      contentStatus: "posted",
      sampleRequired: true,
    })).toBe("campaign_complete");

    expect(deriveCreatorCampaignNextAction({
      outreachStatus: "accepted",
      sampleStatus: "requested",
      contentStatus: "cancelled",
      sampleRequired: true,
    })).toBe("campaign_complete");
  });
});

describe("Sample lifecycle integration planning", () => {
  it("requires accepted outreach before any Sample mutation", () => {
    expect(planSampleLifecycleTransition({
      outreachStatus: "sent",
      currentStatus: "not_requested",
      targetStatus: "requested",
    })).toEqual({ ok: false, error: "SAMPLE_OUTREACH_NOT_ACCEPTED" });
  });

  it("reuses the canonical Sample transition graph", () => {
    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "requested",
      targetStatus: "delivered",
      fulfillmentReference: "ship-1",
    })).toEqual({ ok: false, error: "SAMPLE_TRANSITION_DENIED" });

    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "requested",
      targetStatus: "approved",
    })).toEqual({
      ok: true,
      currentStatus: "requested",
      targetStatus: "approved",
      fulfillmentReference: null,
    });
  });

  it("requires a tracking/fulfillment reference when fulfillment begins", () => {
    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "approved",
      targetStatus: "ordered",
    })).toEqual({
      ok: false,
      error: "SAMPLE_FULFILLMENT_REFERENCE_REQUIRED",
    });

    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "approved",
      targetStatus: "ordered",
      fulfillmentReference: " order-123 ",
    })).toEqual({
      ok: true,
      currentStatus: "approved",
      targetStatus: "ordered",
      fulfillmentReference: "order-123",
    });
  });

  it("fails closed on oversized fulfillment references", () => {
    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "ordered",
      targetStatus: "shipped",
      fulfillmentReference: "x".repeat(257),
    })).toEqual({
      ok: false,
      error: "SAMPLE_FULFILLMENT_REFERENCE_INVALID",
    });
  });

  it("allows post-delivery workflow progression without inventing a second tracking reference", () => {
    expect(planSampleLifecycleTransition({
      outreachStatus: "accepted",
      currentStatus: "delivered",
      targetStatus: "content_due",
    })).toEqual({
      ok: true,
      currentStatus: "delivered",
      targetStatus: "content_due",
      fulfillmentReference: null,
    });
  });
});
