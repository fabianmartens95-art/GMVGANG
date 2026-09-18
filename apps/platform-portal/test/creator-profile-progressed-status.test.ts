import { describe, expect, it } from "vitest";
import { parseCreatorProfileResult, renderCreatorProfile } from "../src/creator-profile.js";

const base = {
  ok: true,
  creatorProfile: {
    id: "creator-profile-1",
    tiktokHandle: "creator.one",
    displayName: "Creator One",
    market: "DE",
    language: "de",
    niche: ["beauty"],
    networkStatus: "qualified",
    profileCompletionPercent: 100,
    referralCode: "GMVABC123",
  },
} as const;

describe("progressed creator profile states", () => {
  it("accepts a qualified creator profile returned by the server", () => {
    const result = parseCreatorProfileResult(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creatorProfile.networkStatus).toBe("qualified");
  });

  it("keeps identity fields protected after network progression", () => {
    const html = renderCreatorProfile(parseCreatorProfileResult(base));
    expect(html).toContain("Qualifiziert");
    expect(html.match(/readonly aria-readonly=\"true\"/g)).toHaveLength(1);
    expect(html).toContain('select name="market" required autocomplete="country" disabled aria-disabled="true"');
    expect(html).toContain('select name="language" required disabled aria-disabled="true"');
    expect(html).toContain('type="checkbox" name="niche" value="beauty" checked disabled aria-disabled="true"');
  });
});
