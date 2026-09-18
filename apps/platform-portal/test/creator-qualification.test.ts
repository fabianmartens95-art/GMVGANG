import { describe, expect, it } from "vitest";
import type { CreatorQualification } from "@gmvgang/creator-qualification";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import { renderCreatorQualification, shouldDisableCategoryOption } from "../src/creator-qualification.js";

function profile(networkStatus: CreatorProfile["networkStatus"]): CreatorProfile {
  return {
    id: "creator-profile-1",
    userId: "user-1",
    tiktokHandle: "creator.test",
    displayName: "Creator Test",
    market: "DE",
    language: "de",
    niche: ["beauty"],
    networkStatus,
    profileCompletionPercent: networkStatus === "registered" ? 40 : 100,
    referralCode: "GMVTEST123",
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
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
  submittedAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "2026-09-17T10:00:00.000Z",
};

describe("creator qualification module", () => {
  it("prevents selecting a fourth product category", () => {
    expect(shouldDisableCategoryOption(0, false)).toBe(false);
    expect(shouldDisableCategoryOption(2, false)).toBe(false);
    expect(shouldDisableCategoryOption(3, false)).toBe(true);
    expect(shouldDisableCategoryOption(3, true)).toBe(false);
    expect(shouldDisableCategoryOption(4, false)).toBe(true);
  });


  it("blocks R2 while the creator profile is incomplete", () => {
    const html = renderCreatorQualification(profile("registered"), null);
    expect(html).toContain("Profil zuerst vervollständigen");
    expect(html).not.toContain('id="creator-qualification-form"');
  });

  it("renders the native R2 form for profile-complete creators", () => {
    const html = renderCreatorQualification(profile("profile_complete"), qualification);
    expect(html).toContain('id="creator-qualification-form"');
    expect(html).not.toContain("novalidate");
    expect(html).toContain('aria-live="polite"');
    expect(html.indexOf('id="qualification-message"')).toBeGreaterThan(html.indexOf('class="qualification-actions"'));
    expect(html).toContain("r2-v3.0");
    expect(html).toContain('value="500_2500" selected');
    expect(html).toContain("Noch keine Adresse, Bank-, Steuer- oder Ausweisdaten");
  });

  it("does not ask for content language twice and distinguishes Shop categories from profile niches", () => {
    const html = renderCreatorQualification(profile("profile_complete"), null);
    expect(html).toContain("Aus deinem Creator-Profil übernommen");
    expect(html).toContain("Content-Sprache: Deutsch");
    expect(html).toContain('type="hidden" name="contentLanguage" value="de"');
    expect(html).not.toContain("<label>Content-Sprache");
    expect(html).toContain("TikTok-Shop Produktkategorien · 1–3");
    expect(html).toContain("Deine Profil-Nischen sind vorausgewählt");
    expect(html).toContain('name="contentCategories" value="beauty" checked');
  });

  it("locks the snapshot after internal network progression", () => {
    const html = renderCreatorQualification(profile("qualified"), qualification);
    expect(html).toContain("Qualifizierung ist gesperrt");
    expect(html).toContain("R2-Selbstauskunft bleibt als Snapshot erhalten");
    expect(html).not.toContain('id="creator-qualification-form"');
  });
});
