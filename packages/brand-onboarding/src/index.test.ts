import { describe, expect, it } from "vitest";

import { evaluateBrandOnboarding } from "./index.js";

describe("evaluateBrandOnboarding", () => {
  it("derives completion from required Brand identity/contact fields", () => {
    expect(evaluateBrandOnboarding({
      legalName: "GMV Brand GmbH",
      countryCode: "de",
      contactName: "Max Mustermann",
      contactEmail: "MAX@EXAMPLE.COM",
      primaryGoal: "creator_growth",
    })).toEqual({
      completionPercent: 100,
      complete: true,
      missingFields: [],
      nextBestAction: "onboarding_complete",
    });
  });

  it("does not require a website to complete onboarding", () => {
    expect(evaluateBrandOnboarding({
      legalName: "GMV Brand GmbH",
      countryCode: "DE",
      contactName: "Max Mustermann",
      contactEmail: "max@example.com",
      primaryGoal: "shop_growth",
      websiteUrl: null,
    }).complete).toBe(true);
  });

  it("returns deterministic missing fields and next best action", () => {
    expect(evaluateBrandOnboarding({
      countryCode: "DE",
      contactName: "Max Mustermann",
      contactEmail: "max@example.com",
      primaryGoal: "profitability",
    })).toEqual({
      completionPercent: 80,
      complete: false,
      missingFields: ["legal_name"],
      nextBestAction: "add_legal_name",
    });

    expect(evaluateBrandOnboarding({})).toEqual({
      completionPercent: 0,
      complete: false,
      missingFields: [
        "legal_name",
        "country_code",
        "contact_name",
        "contact_email",
        "primary_goal",
      ],
      nextBestAction: "add_legal_name",
    });
  });

  it("fails incomplete on malformed country code or email", () => {
    const result = evaluateBrandOnboarding({
      legalName: "GMV Brand GmbH",
      countryCode: "Germany",
      contactName: "Max Mustermann",
      contactEmail: "invalid",
      primaryGoal: "creator_growth",
    });

    expect(result.complete).toBe(false);
    expect(result.completionPercent).toBe(60);
    expect(result.missingFields).toEqual(["country_code", "contact_email"]);
    expect(result.nextBestAction).toBe("add_country");
  });
});
