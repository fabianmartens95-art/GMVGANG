import { describe, expect, it } from "vitest";
import { demoLedgers, demoNow } from "./demo";
import { buildCampaignCockpitView, buildPortfolioCockpitView } from "./model";

describe("campaign cockpit view model", () => {
  it("projects campaign execution into operational creator rows", () => {
    const view = buildCampaignCockpitView(demoLedgers[0]!, demoNow);

    expect(view.status).toBe("active");
    expect(view.summary.totalCreators).toBe(4);
    expect(view.summary.outreachSent).toBe(4);
    expect(view.summary.accepted).toBe(3);
    expect(view.summary.samplesDelivered).toBe(2);
    expect(view.summary.creatorsPosted).toBe(1);
    expect(view.summary.gmV).toBe(1860);
    expect(view.actions.map((action) => action.kind)).toEqual([
      "send-follow-up",
      "approve-sample",
      "content-reminder"
    ]);
    expect(view.blockers).toEqual(["creator-mia: Content pending after delivery"]);
    expect(view.health).toBe("attention");
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
