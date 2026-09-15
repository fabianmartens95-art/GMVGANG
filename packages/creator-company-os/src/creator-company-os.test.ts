import { describe, expect, it } from "vitest";
import {
  buildPortalRegistrationProperties,
  decideCreatorUpsert,
} from "./creator-company-os";

describe("creator Company OS contract", () => {
  it("maps portal registrations only to existing SSOT fields", () => {
    expect(
      buildPortalRegistrationProperties({
        fullName: "Creator One",
        normalizedHandle: "@Creator.One",
        normalizedEmail: "CREATOR@example.com",
      }),
    ).toEqual({
      "TikTok Name": "creator.one",
      "TikTok Handle": "@creator.one",
      "E-Mail": "creator@example.com",
      "Vollständiger Name": "Creator One",
      Status: "Screening",
      "Bewerbung Quelle": "Website",
      "Mindestens 18 Jahre": true,
      "Datenschutz bestätigt": true,
    });
  });

  it("marks native referral registrations as recommendations", () => {
    expect(
      buildPortalRegistrationProperties({
        fullName: "Creator Two",
        normalizedHandle: "creator.two",
        normalizedEmail: "creator2@example.com",
        referralCode: "ABC123",
      })["Bewerbung Quelle"],
    ).toBe("Empfehlung");
  });

  it("creates when neither handle nor email exists", () => {
    expect(decideCreatorUpsert({ handleMatches: [], emailMatches: [] })).toEqual({ action: "create" });
  });

  it("updates when handle and email resolve to the same page", () => {
    expect(
      decideCreatorUpsert({
        handleMatches: [{ pageId: "creator-page-1" }],
        emailMatches: [{ pageId: "creator-page-1" }],
      }),
    ).toEqual({ action: "update", pageId: "creator-page-1" });
  });

  it("updates an existing creator from either single stable identity", () => {
    expect(
      decideCreatorUpsert({
        handleMatches: [{ pageId: "creator-page-1" }],
        emailMatches: [],
      }),
    ).toEqual({ action: "update", pageId: "creator-page-1" });
  });

  it("blocks automatic merging when handle and email point at different creators", () => {
    expect(
      decideCreatorUpsert({
        handleMatches: [{ pageId: "creator-page-1" }],
        emailMatches: [{ pageId: "creator-page-2" }],
      }),
    ).toEqual({
      action: "conflict",
      reason: "identity_split",
      pageIds: ["creator-page-1", "creator-page-2"],
    });
  });

  it("blocks ambiguous duplicate matches", () => {
    expect(
      decideCreatorUpsert({
        handleMatches: [{ pageId: "b" }, { pageId: "a" }],
        emailMatches: [],
      }),
    ).toEqual({
      action: "conflict",
      reason: "multiple_handle_matches",
      pageIds: ["a", "b"],
    });
  });
});
