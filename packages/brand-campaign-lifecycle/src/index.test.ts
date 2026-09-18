import { describe, expect, it } from "vitest";

import { campaignActionRequired, planCampaignTransition } from "./index.js";

const NOW = "2026-09-18T12:00:00.000Z";

const draft = {
  status: "draft" as const,
  clientApproved: false,
  approvedAt: null,
  launchedAt: null,
  completedAt: null,
};

describe("Brand Campaign lifecycle", () => {
  it("requires client approval before draft can become approved", () => {
    expect(planCampaignTransition({
      current: draft,
      target: "approved",
      now: NOW,
    })).toEqual({
      ok: false,
      error: "CAMPAIGN_CLIENT_APPROVAL_REQUIRED",
    });

    const result = planCampaignTransition({
      current: { ...draft, clientApproved: true },
      target: "approved",
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      event: "campaign.approved",
      next: {
        status: "approved",
        clientApproved: true,
        approvedAt: NOW,
        launchedAt: null,
        completedAt: null,
      },
    });
  });

  it("prevents jumping directly from draft to active", () => {
    expect(planCampaignTransition({
      current: { ...draft, clientApproved: true },
      target: "active",
      now: NOW,
    })).toEqual({
      ok: false,
      error: "CAMPAIGN_TRANSITION_DENIED",
    });
  });

  it("launches only approved campaigns and records launch time once", () => {
    const current = {
      status: "approved" as const,
      clientApproved: true,
      approvedAt: "2026-09-18T10:00:00.000Z",
      launchedAt: null,
      completedAt: null,
    };

    expect(planCampaignTransition({
      current,
      target: "active",
      now: NOW,
    })).toEqual({
      ok: true,
      event: "campaign.launched",
      next: {
        ...current,
        status: "active",
        launchedAt: NOW,
      },
    });
  });

  it("supports pause and resume without replacing original launch time", () => {
    const launchedAt = "2026-09-18T11:00:00.000Z";
    const paused = planCampaignTransition({
      current: {
        status: "active",
        clientApproved: true,
        approvedAt: "2026-09-18T10:00:00.000Z",
        launchedAt,
        completedAt: null,
      },
      target: "paused",
      now: NOW,
    });

    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    const resumed = planCampaignTransition({
      current: paused.next,
      target: "active",
      now: "2026-09-18T13:00:00.000Z",
    });

    expect(resumed).toMatchObject({
      ok: true,
      event: "campaign.resumed",
      next: {
        status: "active",
        launchedAt,
      },
    });
  });

  it("makes completed and cancelled campaigns terminal", () => {
    for (const status of ["completed", "cancelled"] as const) {
      expect(planCampaignTransition({
        current: {
          status,
          clientApproved: true,
          approvedAt: NOW,
          launchedAt: NOW,
          completedAt: status === "completed" ? NOW : null,
        },
        target: "active",
        now: "2026-09-19T12:00:00.000Z",
      })).toEqual({
        ok: false,
        error: "CAMPAIGN_TRANSITION_DENIED",
      });
    }
  });

  it("records completion time and rejects malformed timestamps", () => {
    expect(planCampaignTransition({
      current: {
        status: "active",
        clientApproved: true,
        approvedAt: "2026-09-18T10:00:00.000Z",
        launchedAt: "2026-09-18T11:00:00.000Z",
        completedAt: null,
      },
      target: "completed",
      now: NOW,
    })).toMatchObject({
      ok: true,
      event: "campaign.completed",
      next: { completedAt: NOW },
    });

    expect(planCampaignTransition({
      current: { ...draft, clientApproved: true },
      target: "approved",
      now: "not-a-date",
    })).toEqual({
      ok: false,
      error: "CAMPAIGN_TIMESTAMP_INVALID",
    });
  });

  it("derives Brand attention state from campaign lifecycle", () => {
    expect(campaignActionRequired(draft)).toBe("request_client_approval");
    expect(campaignActionRequired({
      ...draft,
      status: "approved",
      clientApproved: true,
      approvedAt: NOW,
    })).toBe("launch_campaign");
    expect(campaignActionRequired({
      ...draft,
      status: "active",
      clientApproved: true,
      approvedAt: NOW,
      launchedAt: NOW,
    })).toBe("none");
  });
});
