import { describe, expect, it } from "vitest";
import type { CreatorQualification } from "@gmvgang/creator-qualification";
import {
  buildCreatorOnboardingModel,
  renderCreatorOnboarding,
} from "../src/creator-onboarding.js";
import type { CreatorProfileResult } from "../src/creator-profile.js";

function profile(
  networkStatus: "registered" | "profile_complete" | "qualified" | "active" | "rejected",
  completion = 100,
): CreatorProfileResult {
  return {
    ok: true,
    creatorProfile: {
      id: "creator-profile-1",
      tiktokHandle: "creator.test",
      displayName: "Creator Test",
      market: "DE",
      language: "de",
      niche: ["beauty"],
      networkStatus,
      profileCompletionPercent: completion,
      referralCode: "GMVTEST123",
    },
  };
}

const qualification: CreatorQualification = {
  id: "qualification-1",
  creatorProfileId: "creator-profile-1",
  schemaVersion: "r2-v3.0",
  shopEnabled: "yes",
  shopGmv30dBand: "500_2500",
  contentFormats: ["shoppable_video"],
  productionStyle: "face",
  contentLanguage: "de",
  contentCategories: ["beauty"],
  agencyBinding: "none",
  videosPerWeekBand: "weekly_3_5",
  sampleTurnaroundBand: "days_3_5",
  violationStatus: "none",
  submittedAt: "2026-09-18T00:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
};

describe("creator onboarding progress", () => {
  it("sends an incomplete creator to the profile", () => {
    const model = buildCreatorOnboardingModel(profile("registered", 40), null);
    expect(model.overallProgress).toBe(35);
    expect(model.nextAction.href).toBe("/creator/profile");
    expect(model.steps[1]?.state).toBe("current");
  });

  it("unlocks qualification after a complete profile", () => {
    const model = buildCreatorOnboardingModel(profile("profile_complete"), null);
    expect(model.overallProgress).toBe(50);
    expect(model.nextAction.href).toBe("/creator/qualification");
    expect(model.steps[2]?.state).toBe("current");
  });

  it("shows review as the next state after qualification submission", () => {
    const model = buildCreatorOnboardingModel(profile("profile_complete"), qualification);
    expect(model.overallProgress).toBe(75);
    expect(model.nextAction.href).toBeUndefined();
    expect(model.nextAction.label).toBe("Review läuft");
    expect(model.steps[3]?.state).toBe("current");
  });

  it("routes qualified creators into matches", () => {
    const model = buildCreatorOnboardingModel(profile("qualified"), qualification);
    expect(model.overallProgress).toBe(100);
    expect(model.nextAction.href).toBe("/creator/matches");
    expect(model.steps.every((step) => step.state === "complete")).toBe(true);
  });

  it("keeps rejected network status visible without claiming approval", () => {
    const model = buildCreatorOnboardingModel(profile("rejected"), qualification);
    expect(model.overallProgress).toBe(75);
    expect(model.steps[3]?.state).toBe("attention");
    expect(model.nextAction.label).toBe("Review abgeschlossen");
  });

  it("renders the progress and next best action", () => {
    const html = renderCreatorOnboarding(
      buildCreatorOnboardingModel(profile("profile_complete"), null),
    );
    expect(html).toContain("ONBOARDING PROGRESS");
    expect(html).toContain('value="50"');
    expect(html).toContain("NEXT BEST ACTION");
    expect(html).toContain('href="/creator/qualification"');
  });
});
