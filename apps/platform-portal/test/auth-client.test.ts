import { describe, expect, it } from "vitest";

import { safeNextPath } from "../src/auth-client.js";

describe("portal safeNextPath", () => {
  it("keeps local referral destinations", () => {
    expect(safeNextPath("/join?ref=ABC123")).toBe("/join?ref=ABC123");
  });

  it("rejects external and backslash redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
});
