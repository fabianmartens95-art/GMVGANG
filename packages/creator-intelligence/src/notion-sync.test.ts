import { describe, expect, it } from "vitest";
import { importNotionCreator, importNotionCreators } from "./notion-sync";
import type { CreatorPerformance } from "./creator";

const performance: CreatorPerformance = {
  gmV30d: 4200,
  orders30d: 91,
  conversionRate: 0.055,
  posts30d: 8,
  liveHours30d: 6,
  sampleToPostRate: 0.8,
  lastActiveAt: new Date().toISOString()
};

function notionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "notion-page-1",
    "TikTok Name": "Demo Creator",
    "TikTok Handle": "@demo_creator",
    "Profil URL": "https://www.tiktok.com/@demo_creator",
    Follower: 25000,
    "Ø Views letzte 10 Videos": 12000,
    "Account-Region": "Deutschland",
    "Haupt-Zielgruppe": "DACH",
    Kategorie: JSON.stringify(["Beauty", "Lifestyle"]),
    "Content-Format": JSON.stringify(["Shoppable Videos", "LIVE Shopping"]),
    "Content-Sprache": "Deutsch & Englisch",
    "Creator-Tier": "Core",
    Status: "Aktiv",
    "Intake-Stage": "Aktiv",
    "TikTok Shop Erfahrung": "Erfahren",
    "TikTok Shop GMV 30 Tage": "2.500–10.000 €",
    "Live Erfahrung": "Erfahren",
    "Video-Kapazität / Woche": "3–5",
    "LIVE-Verfügbarkeit / Woche": "2–3× pro Woche",
    "Compliance-Risiko": "Niedrig",
    "Legal Hold": "__NO__",
    "TikTok Verstöße 90 Tage": "Nein",
    "Creator nicht aufnehmen": "__NO__",
    Raus: "__NO__",
    Löschstatus: "Aktiv",
    "Screening-Score (manuell)": 84,
    "E-Mail": "ignored@example.test",
    "WhatsApp / Telefon": "+490000000",
    ...overrides
  };
}

describe("Notion creator sync contract", () => {
  it("maps operational Company OS fields into the creator intelligence model", () => {
    const result = importNotionCreator(notionRow(), performance);

    expect(result.warnings).toEqual([]);
    expect(result.profile).toMatchObject({
      id: "notion-page-1",
      handle: "demo_creator",
      markets: ["DE"],
      languages: ["de", "en"],
      categories: ["beauty", "lifestyle"],
      channels: ["video", "live"],
      followers: 25000,
      performance
    });
    expect(result.operations).toMatchObject({
      creatorId: "notion-page-1",
      source: "notion",
      tier: "Core",
      lifecycleStatus: "Aktiv",
      intakeStage: "Aktiv",
      eligibleForMatching: true,
      exclusionReasons: []
    });
    expect(result.operations).not.toHaveProperty("E-Mail");
    expect(result.operations).not.toHaveProperty("WhatsApp / Telefon");
  });

  it("turns compliance, legal and retention blockers into explicit exclusions", () => {
    const result = importNotionCreator(notionRow({
      "Legal Hold": "__YES__",
      "Compliance-Risiko": "Blocker",
      "TikTok Verstöße 90 Tage": "Ja – aktuell aktiv",
      Löschstatus: "Löschbereit"
    }));

    expect(result.operations.eligibleForMatching).toBe(false);
    expect(result.operations.exclusionReasons).toEqual([
      "legal-hold",
      "compliance-blocker",
      "active-tiktok-violation",
      "retention-blocked"
    ]);
    expect(result.warnings).toContain("performance-not-linked");
  });

  it("does not create a matchable creator when the canonical TikTok handle is missing", () => {
    const result = importNotionCreator(notionRow({ "TikTok Handle": "" }));

    expect(result.profile).toBeNull();
    expect(result.operations.eligibleForMatching).toBe(false);
    expect(result.warnings).toContain("missing-tiktok-handle");
  });

  it("returns excluded ids for direct use by product matching", () => {
    const batch = importNotionCreators([
      notionRow(),
      notionRow({ id: "notion-page-2", "TikTok Handle": "@blocked", "Creator nicht aufnehmen": "__YES__" })
    ], { "notion-page-1": performance });

    expect(batch.creators).toHaveLength(2);
    expect(batch.excludedCreatorIds).toEqual(["notion-page-2"]);
    expect(batch.warnings).toContainEqual({ creatorId: "notion-page-2", code: "performance-not-linked" });
  });
});
