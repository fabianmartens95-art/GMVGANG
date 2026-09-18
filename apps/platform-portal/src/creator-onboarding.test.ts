import type { CreatorQualification } from "@gmvgang/creator-qualification";
import { describe, expect, it } from "vitest";

import {
  buildCreatorOnboardingModel,
  renderCreatorOnboarding,
} from "./creator-onboarding.js";
import type { CreatorProfileResult } from "./creator-profile.js";
import { creatorNetworkStatusPresentation } from "./creator-status.js";

function profile(
  networkStatus: "registered" | "profile_complete" | "qualified" | "rejected",
  profileCompletionPercent: number,
): CreatorProfileResult {
  return {
    ok: true,
    creatorProfile: {
      id: "creator-1",
      tiktokHandle: "creator",
      displayName: "Creator",
      market: "DE",
      language: "de",
      niche: ["lifestyle"],
      networkStatus,
      profileCompletionPercent,
      referralCode: "REF123",
    },
  };
}

const submittedQualification = {} as CreatorQualification;

describe("creator onboarding status model", () => {
  it("keeps raw lifecycle identifiers behind the presentation boundary", () => {
    const status = creatorNetworkStatusPresentation("profile_complete");

    expect(status.label).toBe("Freigabe ausstehend");
    expect(status.label).not.toContain("_");
  });

  it("keeps setup progress separate from profile completion", () => {
    const model = buildCreatorOnboardingModel(profile("registered", 40), null);

    expect(model.setupCompletedSteps).toBe(1);
    expect(model.setupTotalSteps).toBe(4);
    expect(model.profileCompletionPercent).toBe(40);
    expect(model.networkStatusLabel).toBe("Profilaufbau");
    expect(model.nextAction.href).toBe("/creator/profile");

    const html = renderCreatorOnboarding(model);
    expect(html).toContain("1/4");
    expect(html).toContain("40%");
    expect(html).not.toContain("35%");
    expect(html).not.toContain("75%");
  });

  it("shows review as a status instead of another percentage", () => {
    const model = buildCreatorOnboardingModel(
      profile("profile_complete", 100),
      submittedQualification,
    );

    expect(model.setupCompletedSteps).toBe(3);
    expect(model.profileCompletionPercent).toBe(100);
    expect(model.networkStatusLabel).toBe("Freigabe ausstehend");
    expect(model.nextAction.label).toBe("Review läuft");
    expect(model.nextAction.href).toBeUndefined();

    const html = renderCreatorOnboarding(model);
    expect(html).toContain("3/4");
    expect(html).toContain("100%");
    expect(html).toContain("Freigabe ausstehend");
    expect(html).toContain("Review läuft");
  });

  it("marks the four setup phases complete only after network approval", () => {
    const model = buildCreatorOnboardingModel(
      profile("qualified", 100),
      submittedQualification,
    );

    expect(model.setupCompletedSteps).toBe(4);
    expect(model.networkStatusLabel).toBe("Qualifiziert");
    expect(model.nextAction.href).toBe("/creator/matches");
  });

  it("keeps a rejected network decision status-based", () => {
    const model = buildCreatorOnboardingModel(
      profile("rejected", 100),
      submittedQualification,
    );

    expect(model.setupCompletedSteps).toBe(3);
    expect(model.networkStatusTone).toBe("attention");
    expect(model.networkStatusLabel).toBe("Nicht freigegeben");
    expect(model.nextAction.label).toBe("Review abgeschlossen");
  });

  it("does not invent profile or network percentages when the profile is unavailable", () => {
    const model = buildCreatorOnboardingModel(
      { ok: false, errors: ["creator_profile_unavailable"] },
      null,
    );

    expect(model.setupCompletedSteps).toBe(1);
    expect(model.profileCompletionPercent).toBeNull();
    expect(model.networkStatusLabel).toBe("Noch nicht verfügbar");

    const html = renderCreatorOnboarding(model);
    expect(html).toContain("1/4");
    expect(html).toContain("Noch nicht verfügbar");
    expect(html).not.toMatch(/\b\d+%\b/);
  });
});
