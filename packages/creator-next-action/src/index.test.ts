import { describe, expect, it } from "vitest";

import { recommendCreatorNextBestAction } from "./index.js";

const ready = {
  profileComplete: true,
  qualificationComplete: true,
  tiktokState: "connected" as const,
  pendingCampaignDecisions: 0,
  pendingContentSubmissions: 0,
  pendingSampleActions: 0,
};

describe("recommendCreatorNextBestAction", () => {
  it("prioritizes profile and qualification gates before every downstream action", () => {
    expect(recommendCreatorNextBestAction({
      ...ready,
      profileComplete: false,
      pendingCampaignDecisions: 4,
    }).id).toBe("complete_profile");

    expect(recommendCreatorNextBestAction({
      ...ready,
      qualificationComplete: false,
      pendingCampaignDecisions: 4,
    }).id).toBe("complete_qualification");
  });

  it("prioritizes TikTok connection recovery before campaign work", () => {
    expect(recommendCreatorNextBestAction({
      ...ready,
      tiktokState: "disconnected",
      pendingCampaignDecisions: 3,
    }).id).toBe("connect_tiktok");

    expect(recommendCreatorNextBestAction({
      ...ready,
      tiktokState: "refresh_required",
      pendingCampaignDecisions: 3,
    }).id).toBe("refresh_tiktok_connection");

    expect(recommendCreatorNextBestAction({
      ...ready,
      tiktokState: "reconnect_required",
    }).id).toBe("reconnect_tiktok");
  });

  it("prioritizes campaign decisions, then samples, then content", () => {
    expect(recommendCreatorNextBestAction({
      ...ready,
      pendingCampaignDecisions: 2,
      pendingSampleActions: 3,
      pendingContentSubmissions: 4,
    }).id).toBe("review_campaign_opportunity");

    expect(recommendCreatorNextBestAction({
      ...ready,
      pendingSampleActions: 3,
      pendingContentSubmissions: 4,
    }).id).toBe("review_sample_status");

    expect(recommendCreatorNextBestAction({
      ...ready,
      pendingContentSubmissions: 4,
    }).id).toBe("submit_campaign_content");
  });

  it("falls back to match discovery when no blocking action exists", () => {
    expect(recommendCreatorNextBestAction(ready)).toEqual({
      id: "explore_matches",
      priority: "normal",
      reason: "Dein Setup ist vollständig. Prüfe neue Matches und Campaign-Opportunities.",
    });
  });

  it("fails closed on malformed counters", () => {
    expect(() => recommendCreatorNextBestAction({
      ...ready,
      pendingCampaignDecisions: -1,
    })).toThrow("CREATOR_NBA_CAMPAIGN_COUNT_INVALID");

    expect(() => recommendCreatorNextBestAction({
      ...ready,
      pendingContentSubmissions: 1.5,
    })).toThrow("CREATOR_NBA_CONTENT_COUNT_INVALID");
  });
});
