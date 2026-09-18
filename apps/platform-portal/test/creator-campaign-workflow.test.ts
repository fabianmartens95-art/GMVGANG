import { describe, expect, it } from "vitest";
import {
  HttpCreatorCampaignWorkflowAdapter,
  parseCreatorCampaignWorkflow,
  renderCreatorCampaignWorkflow,
} from "../src/creator-campaign-workflow.js";

const CAMPAIGN = {
  campaignId: "campaign-1",
  campaignName: "Beauty <Launch>",
  briefLabel: "45s <Briefing>",
  sampleRequired: true,
  outreachStatus: "accepted",
  sampleStatus: "shipped",
  contentStatus: "not_started",
  nextAction: "track_sample",
};

describe("Creator Campaign Workflow surface", () => {
  it("renders canonical workflow status without mutation controls", () => {
    const html = renderCreatorCampaignWorkflow(parseCreatorCampaignWorkflow({
      campaigns: [CAMPAIGN],
    }));

    expect(html).toContain("Sample verfolgen");
    expect(html).toContain("Sample versendet");
    expect(html).not.toContain("data-action");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("method=");
  });

  it("fails closed on unknown states or actions", () => {
    expect(() => parseCreatorCampaignWorkflow({
      campaigns: [{ ...CAMPAIGN, sampleStatus: "lost" }],
    })).toThrow("CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID");

    expect(() => parseCreatorCampaignWorkflow({
      campaigns: [{ ...CAMPAIGN, nextAction: "approve_sample" }],
    })).toThrow("CREATOR_CAMPAIGN_WORKFLOW_ROW_INVALID");
  });

  it("fails closed when next action contradicts the workflow state", () => {
    expect(() => parseCreatorCampaignWorkflow({
      campaigns: [{ ...CAMPAIGN, nextAction: "submit_content" }],
    })).toThrow("CREATOR_CAMPAIGN_WORKFLOW_NEXT_ACTION_INCONSISTENT");

    expect(() => parseCreatorCampaignWorkflow({
      campaigns: [{
        ...CAMPAIGN,
        outreachStatus: "sent",
        sampleStatus: "requested",
        contentStatus: "not_started",
        nextAction: "review_campaign",
      }],
    })).toThrow("CREATOR_CAMPAIGN_WORKFLOW_NEXT_ACTION_INCONSISTENT");
  });

  it("rejects duplicate Campaign IDs", () => {
    expect(() => parseCreatorCampaignWorkflow({
      campaigns: [CAMPAIGN, { ...CAMPAIGN }],
    })).toThrow("CREATOR_CAMPAIGN_WORKFLOW_DUPLICATE_CAMPAIGN");
  });

  it("escapes Campaign and brief labels", () => {
    const html = renderCreatorCampaignWorkflow(parseCreatorCampaignWorkflow({
      campaigns: [CAMPAIGN],
    }));

    expect(html).toContain("Beauty &lt;Launch&gt;");
    expect(html).toContain("45s &lt;Briefing&gt;");
    expect(html).not.toContain("<Launch>");
    expect(html).not.toContain("<Briefing>");
  });

  it("keeps Creator identity server-derived with no browser selector", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorCampaignWorkflowAdapter(
      "/api/creator/campaigns/workflow",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return { campaigns: [CAMPAIGN] }; } };
      },
    );

    await expect(adapter.getCampaigns()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/campaigns/workflow",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("handles no-sample Campaigns with canonical content progression", () => {
    const response = parseCreatorCampaignWorkflow({
      campaigns: [{
        ...CAMPAIGN,
        sampleRequired: false,
        sampleStatus: "not_requested",
        contentStatus: "briefed",
        nextAction: "create_content",
      }],
    });
    expect(renderCreatorCampaignWorkflow(response)).toContain("Content erstellen");
    expect(renderCreatorCampaignWorkflow(response)).toContain("Kein physisches Sample erforderlich");
  });

  it("degrades malformed HTTP responses to unavailable", async () => {
    const adapter = new HttpCreatorCampaignWorkflowAdapter(
      "/api/creator/campaigns/workflow",
      async () => ({
        ok: true,
        async json() { return { campaigns: [{ campaignId: "bad" }] }; },
      }),
    );

    await expect(adapter.getCampaigns()).resolves.toBeNull();
    expect(renderCreatorCampaignWorkflow(null)).toContain("Workflow nicht verfügbar");
  });
});
