import { describe, expect, it } from "vitest";
import {
  HttpBrandCampaignLifecycleAdapter,
  parseBrandCampaignLifecycle,
  renderBrandCampaignLifecycle,
} from "../src/brand-campaign-lifecycle.js";

const ACTIVE = {
  campaignId: "campaign-1",
  campaignName: "Beauty <Launch>",
  status: "active",
  clientApproved: true,
  approvedAt: "2026-09-18T10:00:00.000Z",
  launchedAt: "2026-09-18T11:00:00.000Z",
  completedAt: null,
  actionRequired: "none",
};

describe("Brand Campaign Lifecycle surface", () => {
  it("renders lifecycle state read-only without mutation controls", () => {
    const html = renderBrandCampaignLifecycle(parseBrandCampaignLifecycle({
      campaigns: [ACTIVE],
    }));

    expect(html).toContain("Aktiv");
    expect(html).toContain("Keine Lifecycle-Aktion erforderlich");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-action");
    expect(html).not.toContain("method=");
  });

  it("fails closed on unknown statuses or actions", () => {
    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{ ...ACTIVE, status: "archived" }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID");

    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{ ...ACTIVE, actionRequired: "force_launch" }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_ROW_INVALID");
  });

  it("fails closed on lifecycle timestamp/state inconsistencies", () => {
    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{
        ...ACTIVE,
        status: "approved",
        launchedAt: ACTIVE.launchedAt,
        actionRequired: "launch_campaign",
      }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");

    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{
        ...ACTIVE,
        status: "completed",
        completedAt: null,
      }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_STATE_INCONSISTENT");

    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{
        ...ACTIVE,
        launchedAt: "not-a-date",
      }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_TIMESTAMP_INVALID");
  });

  it("fails closed when action-required contradicts canonical lifecycle semantics", () => {
    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{
        campaignId: "draft-1",
        campaignName: "Draft",
        status: "draft",
        clientApproved: false,
        approvedAt: null,
        launchedAt: null,
        completedAt: null,
        actionRequired: "none",
      }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_ACTION_INCONSISTENT");

    expect(() => parseBrandCampaignLifecycle({
      campaigns: [{
        campaignId: "approved-1",
        campaignName: "Approved",
        status: "approved",
        clientApproved: true,
        approvedAt: "2026-09-18T10:00:00.000Z",
        launchedAt: null,
        completedAt: null,
        actionRequired: "none",
      }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_ACTION_INCONSISTENT");
  });

  it("rejects duplicate Campaign IDs", () => {
    expect(() => parseBrandCampaignLifecycle({
      campaigns: [ACTIVE, { ...ACTIVE }],
    })).toThrow("BRAND_CAMPAIGN_LIFECYCLE_DUPLICATE_CAMPAIGN");
  });

  it("escapes Campaign names", () => {
    const html = renderBrandCampaignLifecycle(parseBrandCampaignLifecycle({
      campaigns: [ACTIVE],
    }));

    expect(html).toContain("Beauty &lt;Launch&gt;");
    expect(html).not.toContain("<Launch>");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandCampaignLifecycleAdapter(
      "org-1",
      "/api/brand/campaigns/lifecycle",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return { campaigns: [ACTIVE] }; } };
      },
    );

    await expect(adapter.getCampaigns()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/campaigns/lifecycle",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("does not issue a request without organization context", async () => {
    let called = false;
    const adapter = new HttpBrandCampaignLifecycleAdapter(
      " ",
      "/api/brand/campaigns/lifecycle",
      async () => {
        called = true;
        return { ok: true, async json() { return { campaigns: [] }; } };
      },
    );

    await expect(adapter.getCampaigns()).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it("renders explicit unavailable and empty states", () => {
    expect(renderBrandCampaignLifecycle(null)).toContain("Status nicht verfügbar");
    expect(renderBrandCampaignLifecycle({ campaigns: [] })).toContain("Noch keine Campaigns");
  });
});
