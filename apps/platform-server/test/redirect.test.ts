import { describe, expect, it } from "vitest";

import { safeNextPath } from "../src/server.js";

describe("safeNextPath", () => {
  it("keeps local paths and query parameters", () => {
    expect(safeNextPath("/join?ref=ABC123")).toBe("/join?ref=ABC123");
  });

  it("rejects external, protocol-relative and backslash redirects", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/");
    expect(safeNextPath("//evil.example/steal")).toBe("/");
    expect(safeNextPath("/\\evil.example/steal")).toBe("/");
  });

  it("rejects oversized and non-string values", () => {
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
