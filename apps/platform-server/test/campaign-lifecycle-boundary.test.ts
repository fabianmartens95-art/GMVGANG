import { describe, expect, it } from "vitest";
import { planPersistedCampaignTransition } from "../src/campaign-lifecycle-boundary.js";

const NOW = "2026-09-19T10:30:00.000Z";

function state(overrides: Partial<Parameters<typeof planPersistedCampaignTransition>[0]["current"]> = {}) {
  return {
    status: "draft",
    client_approved: false,
    approved_at: null,
    launched_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe("Campaign lifecycle server adapter", () => {
  it("fails closed on arbitrary draft to active jumps", () => {
    const plan = planPersistedCampaignTransition({ current: state(), target: "active", now: NOW });
    expect(plan).toEqual({ ok: false, error: "CAMPAIGN_TRANSITION_DENIED" });
  });

  it("requires client approval before approval", () => {
    const plan = planPersistedCampaignTransition({ current: state(), target: "approved", now: NOW });
    expect(plan).toEqual({ ok: false, error: "CAMPAIGN_CLIENT_APPROVAL_REQUIRED" });
  });

  it("preserves original launch timestamp on pause and resume", () => {
    const launchedAt = "2026-09-18T08:00:00.000Z";
    const plan = planPersistedCampaignTransition({
      current: state({ status: "paused", client_approved: true, approved_at: "2026-09-18T07:00:00.000Z", launched_at: launchedAt }),
      target: "active",
      now: NOW,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.next.launchedAt).toBe(launchedAt);
  });

  it("keeps terminal campaigns closed", () => {
    const plan = planPersistedCampaignTransition({
      current: state({ status: "completed", client_approved: true, completed_at: "2026-09-18T09:00:00.000Z" }),
      target: "active",
      now: NOW,
    });
    expect(plan).toEqual({ ok: false, error: "CAMPAIGN_TRANSITION_DENIED" });
  });

  it("rejects unknown persisted states and malformed timestamps", () => {
    expect(() => planPersistedCampaignTransition({ current: state({ status: "launching" }), target: "active", now: NOW })).toThrow("CAMPAIGN_STATE_INVALID");
    expect(() => planPersistedCampaignTransition({ current: state({ approved_at: "not-a-date" }), target: "approved", now: NOW })).toThrow("CAMPAIGN_STATE_INVALID");
  });
});
