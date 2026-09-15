import { describe, expect, it } from "vitest";
import { demoLedgers, demoNow } from "./demo";
import { buildCampaignCockpitView, buildPortfolioCockpitView } from "./model";

describe("campaign cockpit view model", () => {
  it("projects campaign execution into operational creator rows", () => {
    const view = buildCampaignCockpitView(demoLedgers[0]!, demoNow);

    expect(view.status).toBe("active");
    expect(view.readinessReady).toBe(true);
    expect(view.clientApproved).toBe(true);
    expect(view.summary.totalCreators).toBe(4);
    expect(view.summary.outreachSent).toBe(4);
    expect(view.summary.accepted).toBe(3);
    expect(view.summary.samplesDelivered).toBe(2);
    expect(view.summary.creatorsPosted).toBe(1);
    expect(view.summary.gmV).toBe(1860);
    expect(view.actions.map((action) => action.kind)).toEqual([
      "approve-sample",
      "content-reminder",
      "send-follow-up"
    ]);
    expect(view.blockers).toEqual(["creator-mia: Content pending after delivery"]);
    expect(view.health).toBe("attention");
  });

  it("renders an unevaluated draft as blocked with no external actions", () => {
    const view = buildCampaignCockpitView(demoLedgers[1]!, demoNow);

    expect(view.status).toBe("draft");
    expect(view.readinessReady).toBe(false);
    expect(view.health).toBe("blocked");
    expect(view.actions).toEqual([]);
    expect(view.blockers[0]).toBe("Campaign: Readiness not evaluated");
    expect(view.creators.every((creator) => creator.blocker?.startsWith("Readiness:"))).toBe(true);
  });

  it("aggregates portfolio KPIs without duplicating campaign state", () => {
    const portfolio = buildPortfolioCockpitView(demoLedgers, demoNow);

    expect(portfolio.totalCampaigns).toBe(2);
    expect(portfolio.activeCampaigns).toBe(1);
    expect(portfolio.totalCreators).toBe(7);
    expect(portfolio.gmV).toBe(1860);
    expect(portfolio.orders).toBe(61);
    expect(portfolio.commission).toBe(279);
    expect(portfolio.pendingActions).toBe(3);
    expect(portfolio.approvalActions).toBe(3);
    expect(portfolio.campaignsNeedingAttention).toBe(2);
  });
});
