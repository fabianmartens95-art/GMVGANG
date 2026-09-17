import { describe, expect, it } from "vitest";
import type { CreatorProfile } from "@gmvgang/platform-foundation";

import { governCreatorSelfServiceProfileInput } from "../src/index.js";

const COMPLETE_PROFILE: CreatorProfile = {
  id: "creator-1",
  userId: "user-1",
  tiktokHandle: "petrus.lives",
  displayName: "PetrusLives",
  market: "DE",
  language: "DE",
  niche: ["Beauty Test"],
  networkStatus: "profile_complete",
  profileCompletionPercent: 100,
  referralCode: "GMV53ABF354989D",
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

describe("governCreatorSelfServiceProfileInput", () => {
  it("allows display-name self service but preserves verified identity and matching fields", () => {
    const governed = governCreatorSelfServiceProfileInput(COMPLETE_PROFILE, {
      tiktokHandle: "attacker.changed",
      displayName: "Neuer Anzeigename",
      market: "US",
      language: "EN",
      niche: ["Gaming"],
    });

    expect(governed).toEqual({
      tiktokHandle: "petrus.lives",
      displayName: "Neuer Anzeigename",
      market: "DE",
      language: "DE",
      niche: ["Beauty Test"],
    });
  });

  it("keeps the onboarding completion command unrestricted before profile_complete", () => {
    const registered: CreatorProfile = {
      ...COMPLETE_PROFILE,
      networkStatus: "registered",
      profileCompletionPercent: 20,
    };
    const input = {
      tiktokHandle: "petrus.lives",
      displayName: "PetrusLives",
      market: "DE",
      language: "de",
      niche: ["Lifestyle"],
    };

    expect(governCreatorSelfServiceProfileInput(registered, input)).toBe(input);
  });

  it("fails closed when a completed profile is missing governed source fields", () => {
    const { niche: _niche, ...withoutNiche } = COMPLETE_PROFILE;
    const invalid: CreatorProfile = withoutNiche;
    expect(() => governCreatorSelfServiceProfileInput(invalid, {
      tiktokHandle: "petrus.lives",
      displayName: "PetrusLives",
      market: "DE",
      language: "DE",
      niche: ["Lifestyle"],
    })).toThrow("CREATOR_PROFILE_GOVERNANCE_STATE_INVALID");
  });
});
