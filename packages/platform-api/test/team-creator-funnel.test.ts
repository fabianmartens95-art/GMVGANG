import { describe, expect, it } from "vitest";
import {
  buildTeamCreatorFunnelReadModel,
  type TeamCreatorFunnelSource,
} from "../src/team-creator-funnel.js";

const NOW = "2026-09-17T22:00:00.000Z";

function source(): TeamCreatorFunnelSource {
  return {
    users: [
      { id: "creator-1", email: "creator@example.com", is_test_account: false, created_at: "2026-09-17T20:00:00.000Z", updated_at: "2026-09-17T20:00:00.000Z" },
      { id: "creator-2", email: "active@example.com", is_test_account: false, created_at: "2026-09-17T21:50:00.000Z", updated_at: "2026-09-17T21:50:00.000Z" },
      { id: "founder", email: "founder@example.com", is_test_account: false, created_at: "2026-09-17T19:00:00.000Z", updated_at: "2026-09-17T19:00:00.000Z" },
      { id: "test-creator", email: "test@example.com", is_test_account: true, created_at: "2026-09-17T21:45:00.000Z", updated_at: "2026-09-17T21:45:00.000Z" },
    ],
    profiles: [
      { id: "profile-1", user_id: "creator-1", tiktok_handle: "stalled", display_name: "Stalled", network_status: "profile_complete", profile_completion_percent: 100, created_at: "2026-09-17T20:05:00.000Z", updated_at: "2026-09-17T20:10:00.000Z" },
      { id: "profile-2", user_id: "creator-2", tiktok_handle: "active", display_name: "Active", network_status: "registered", profile_completion_percent: 40, created_at: "2026-09-17T21:52:00.000Z", updated_at: "2026-09-17T21:55:00.000Z" },
      { id: "profile-founder", user_id: "founder", tiktok_handle: "internal", display_name: "Internal", network_status: "profile_complete", profile_completion_percent: 100, created_at: "2026-09-17T19:05:00.000Z", updated_at: "2026-09-17T19:05:00.000Z" },
      { id: "profile-test", user_id: "test-creator", tiktok_handle: "seed", display_name: "Seed Account", network_status: "profile_complete", profile_completion_percent: 100, created_at: "2026-09-17T21:46:00.000Z", updated_at: "2026-09-17T21:46:00.000Z" },
    ],
    qualifications: [],
    memberships: [
      { user_id: "creator-1", role: "creator", status: "active" },
      { user_id: "creator-2", role: "creator", status: "active" },
      { user_id: "founder", role: "founder", status: "active" },
      { user_id: "founder", role: "creator", status: "active" },
      { user_id: "test-creator", role: "creator", status: "active" },
    ],
    analytics: [
      { user_id: "creator-2", event_name: "portal.page_view", path: "/creator/profile", occurred_at: "2026-09-17T21:58:00.000Z" },
    ],
    audit: [],
  };
}

describe("team creator funnel read model", () => {
  it("flags incomplete idle creators as stalled and excludes internal or test accounts", () => {
    const model = buildTeamCreatorFunnelReadModel(source(), NOW);

    expect(model.summary.totalCreators).toBe(2);
    expect(model.summary.stalled).toBe(1);
    expect(model.summary.inProgress).toBe(1);
    expect(model.creators.some((creator) => creator.userId === "founder")).toBe(false);
    expect(model.creators.some((creator) => creator.userId === "test-creator")).toBe(false);
    expect(model.creators.find((creator) => creator.userId === "creator-1")).toMatchObject({
      currentStep: "qualification",
      health: "stalled",
    });
    expect(model.creators.find((creator) => creator.userId === "creator-2")).toMatchObject({
      currentStep: "profile",
      health: "in_progress",
      lastActivityAt: "2026-09-17T21:58:00.000Z",
    });
  });

  it("marks submitted qualifications complete", () => {
    const data = source();
    data.qualifications.push({
      creator_profile_id: "profile-2",
      submitted_at: "2026-09-17T21:59:00.000Z",
      updated_at: "2026-09-17T21:59:00.000Z",
    });
    const model = buildTeamCreatorFunnelReadModel(data, NOW);
    expect(model.creators.find((creator) => creator.userId === "creator-2")).toMatchObject({
      currentStep: "complete",
      health: "complete",
    });
  });
});
