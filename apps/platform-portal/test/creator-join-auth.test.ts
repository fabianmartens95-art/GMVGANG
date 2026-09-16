import { describe, expect, it } from "vitest";

import { renderCreatorJoin } from "../src/creator-join.js";

describe("Creator Join login handoff", () => {
  it("preserves referral attribution while requiring authentication", () => {
    const html = renderCreatorJoin(
      { status: "anonymous", roles: [] },
      { privacyNoticeVersion: "privacy-v1", referralCode: "abc123" },
    );
    expect(html).toContain("Creator Account erforderlich");
    expect(html).toContain("/login?next=%2Fjoin%3Fref%3DABC123");
    expect(html).not.toContain("creator-registration-form");
  });
});
