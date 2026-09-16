import { describe, expect, it } from "vitest";

import { parseCreatorRegistrationPayload } from "../server/api.js";

describe("parseCreatorRegistrationPayload", () => {
  it("accepts only the allowlisted Creator registration fields", () => {
    const parsed = parseCreatorRegistrationPayload({
      tiktokHandle: "@creator.one",
      displayName: "Creator One",
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: "privacy-v1",
      referralCode: "ABC123",
      userId: "attacker-controlled",
      roles: ["admin"],
    });

    expect(parsed).toEqual({
      tiktokHandle: "@creator.one",
      displayName: "Creator One",
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: "privacy-v1",
      referralCode: "ABC123",
    });
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("roles");
  });

  it("rejects malformed required fields", () => {
    expect(() =>
      parseCreatorRegistrationPayload({
        tiktokHandle: "creator",
        ageConfirmed: "yes",
        privacyAccepted: true,
        privacyNoticeVersion: "privacy-v1",
      }),
    ).toThrow("REGISTRATION_PAYLOAD_INVALID");
  });

  it("rejects non-string niche values", () => {
    expect(() =>
      parseCreatorRegistrationPayload({
        tiktokHandle: "creator",
        ageConfirmed: true,
        privacyAccepted: true,
        privacyNoticeVersion: "privacy-v1",
        niche: ["beauty", 123],
      }),
    ).toThrow("REGISTRATION_PAYLOAD_INVALID");
  });
});
