import { describe, expect, it } from "vitest";
import type { CreatorQualification } from "@gmvgang/creator-qualification";
import {
  buildCreatorOnboardingModel,
  renderCreatorOnboarding,
} from "../src/creator-onboarding.js";
import type { CreatorProfileResult } from "../src/creator-profile.js";
import { creatorNetworkStatusPresentation } from "../src/creator-status.js";

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
  it("sends an incomplete creator to the profile without inventing setup percentages", () => {
    const model = buildCreatorOnboardingModel(profile("registered", 40), null);

    expect(model.setupCompletedSteps).toBe(1);
    expect(model.setupTotalSteps).toBe(4);
    expect(model.profileCompletionPercent).toBe(40);
    expect(model.networkStatusLabel).toBe("Profilaufbau");
    expect(model.nextAction.href).toBe("/creator/profile");
    expect(model.steps[1]?.state).toBe("current");
  });

  it("unlocks qualification after the profile phase", () => {
    const model = buildCreatorOnboardingModel(profile("profile_complete"), null);

    expect(model.setupCompletedSteps).toBe(2);
    expect(model.profileCompletionPercent).toBe(100);
    expect(model.networkStatusLabel).toBe("Freigabe ausstehend");
    expect(model.nextAction.href).toBe("/creator/qualification");
    expect(model.steps[2]?.state).toBe("current");
  });

  it("shows review as a status after qualification submission", () => {
    const model = buildCreatorOnboardingModel(profile("profile_complete"), qualification);

    expect(model.setupCompletedSteps).toBe(3);
    expect(model.profileCompletionPercent).toBe(100);
    expect(model.nextAction.href).toBeUndefined();
    expect(model.nextAction.label).toBe("Review läuft");
    expect(model.steps[3]?.state).toBe("current");
  });

  it("routes qualified creators into matches", () => {
    const model = buildCreatorOnboardingModel(profile("qualified"), qualification);

    expect(model.setupCompletedSteps).toBe(4);
    expect(model.networkStatusLabel).toBe("Qualifiziert");
    expect(model.nextAction.href).toBe("/creator/matches");
    expect(model.steps.every((step) => step.state === "complete")).toBe(true);
  });

  it("keeps rejected network status visible without claiming approval", () => {
    const model = buildCreatorOnboardingModel(profile("rejected"), qualification);

    expect(model.setupCompletedSteps).toBe(3);
    expect(model.networkStatusTone).toBe("attention");
    expect(model.networkStatusLabel).toBe("Nicht freigegeben");
    expect(model.steps[3]?.state).toBe("attention");
    expect(model.nextAction.label).toBe("Review abgeschlossen");
  });

  it("renders setup, profile completion and network status as separate truths", () => {
    const html = renderCreatorOnboarding(
      buildCreatorOnboardingModel(profile("profile_complete"), qualification),
    );

    expect(html).toContain("CREATOR SETUP");
    expect(html).toContain("3/4");
    expect(html).toContain("PROFILVOLLSTÄNDIGKEIT");
    expect(html).toContain("100%");
    expect(html).toContain("NETWORK STATUS");
    expect(html).toContain("Freigabe ausstehend");
    expect(html).toContain("NEXT BEST ACTION");
    expect(html).not.toContain("75%");
  });

  it("keeps raw lifecycle identifiers behind the presentation boundary", () => {
    const status = creatorNetworkStatusPresentation("profile_complete");

    expect(status.label).toBe("Freigabe ausstehend");
    expect(status.label).not.toContain("_");
  });
});
