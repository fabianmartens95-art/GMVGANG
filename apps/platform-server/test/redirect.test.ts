import { describe, expect, it } from "vitest";

import { safeConfirmationNextPath, safeNextPath } from "../src/server.js";

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

describe("safeConfirmationNextPath", () => {
  const origin = "https://app.gmvgang.de";

  it("extracts the original local next path from the PKCE callback URL", () => {
    expect(
      safeConfirmationNextPath(
        "https://app.gmvgang.de/auth/callback?next=%2Fjoin%3Fref%3DABC123",
        origin,
      ),
    ).toBe("/join?ref=ABC123");
  });

  it("accepts a direct same-origin destination", () => {
    expect(safeConfirmationNextPath("https://app.gmvgang.de/creator", origin)).toBe("/creator");
  });

  it("rejects external and malformed destinations", () => {
    expect(safeConfirmationNextPath("https://evil.example/steal", origin)).toBe("/");
    expect(safeConfirmationNextPath("not a url", origin)).toBe("/");
  });
});
