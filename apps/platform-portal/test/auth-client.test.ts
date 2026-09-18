import { describe, expect, it } from "vitest";

import { emailDomainSuggestion, safeNextPath } from "../src/auth-client.js";

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


describe("portal emailDomainSuggestion", () => {
  it("catches the same high-confidence typos shown by the server", () => {
    expect(emailDomainSuggestion("creator@gmail.vom")).toBe("gmail.com");
    expect(emailDomainSuggestion("creator@gamil.com")).toBe("gmail.com");
    expect(emailDomainSuggestion("creator@custom-domain.vom")).toBe("custom-domain.com");
  });

  it("leaves valid domains unchanged", () => {
    expect(emailDomainSuggestion("creator@gmail.com")).toBeNull();
    expect(emailDomainSuggestion("creator@brand.de")).toBeNull();
  });
});
