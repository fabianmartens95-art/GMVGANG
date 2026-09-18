import { describe, expect, it } from "vitest";
import {
  HttpBrandCompanyTeamAdapter,
  parseBrandCompanyTeam,
  renderBrandCompanyTeam,
} from "../src/brand-company-team.js";

const MEMBER = {
  membershipId: "membership-1",
  organizationId: "org-1",
  email: "Owner@Brand.de",
  displayName: "Brand <Owner>",
  role: "brand_member",
  status: "active",
  createdAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

const RESPONSE = {
  organization: {
    id: "org-1",
    type: "brand",
    name: "Example <Brand>",
    status: "active",
  },
  profile: {
    organizationId: "org-1",
    legalName: "Example GmbH",
    website: "https://example.com/",
    status: "onboarding",
  },
  members: [MEMBER],
};

describe("Brand Company & Team surface", () => {
  it("renders same-tenant company and team data read-only", () => {
    const html = renderBrandCompanyTeam(parseBrandCompanyTeam(RESPONSE));
    expect(html).toContain("Example &lt;Brand&gt;");
    expect(html).toContain("Brand &lt;Owner&gt;");
    expect(html).toContain("owner@brand.de");
    expect(html).toContain("1 aktiv · 0 eingeladen");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-action");
    expect(html).not.toContain("<form");
  });

  it("fails closed for non-Brand organizations or internal roles", () => {
    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      organization: { ...RESPONSE.organization, type: "gmvgang" },
    })).toThrow("BRAND_COMPANY_TEAM_ORGANIZATION_INVALID");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{ ...MEMBER, role: "brand_manager" }],
    })).toThrow("BRAND_COMPANY_TEAM_MEMBER_INVALID");
  });

  it("fails closed on cross-tenant profile or member rows", () => {
    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      profile: { ...RESPONSE.profile, organizationId: "org-2" },
    })).toThrow("BRAND_COMPANY_TEAM_TENANT_MISMATCH");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{ ...MEMBER, organizationId: "org-2" }],
    })).toThrow("BRAND_COMPANY_TEAM_TENANT_MISMATCH");
  });

  it("rejects revoked members, internal user ids and duplicate memberships", () => {
    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{ ...MEMBER, status: "revoked" }],
    })).toThrow("BRAND_COMPANY_TEAM_MEMBER_INVALID");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{ ...MEMBER, userId: "internal-user" }],
    })).toThrow("BRAND_COMPANY_TEAM_MEMBER_INVALID");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [MEMBER, { ...MEMBER }],
    })).toThrow("BRAND_COMPANY_TEAM_DUPLICATE_MEMBER");
  });

  it("rejects malformed email, timestamps and unsafe websites", () => {
    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{ ...MEMBER, email: "invalid" }],
    })).toThrow("BRAND_COMPANY_TEAM_EMAIL_INVALID");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      members: [{
        ...MEMBER,
        updatedAt: "2026-09-16T10:00:00.000Z",
      }],
    })).toThrow("BRAND_COMPANY_TEAM_TIMESTAMP_INVALID");

    expect(() => parseBrandCompanyTeam({
      ...RESPONSE,
      profile: { ...RESPONSE.profile, website: "javascript:alert(1)" },
    })).toThrow("BRAND_COMPANY_TEAM_WEBSITE_INVALID");
  });

  it("keeps organization selection in the authenticated workspace header", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandCompanyTeamAdapter(
      "org-1",
      "/api/brand/company-team",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return RESPONSE; } };
      },
    );

    await expect(adapter.getCompanyTeam()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/company-team",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("rejects response tenant mismatch and missing organization context", async () => {
    const mismatch = new HttpBrandCompanyTeamAdapter(
      "org-2",
      "/api/brand/company-team",
      async () => ({ ok: true, async json() { return RESPONSE; } }),
    );
    await expect(mismatch.getCompanyTeam()).resolves.toBeNull();

    let called = false;
    const missing = new HttpBrandCompanyTeamAdapter(
      " ",
      "/api/brand/company-team",
      async () => {
        called = true;
        return { ok: true, async json() { return RESPONSE; } };
      },
    );
    await expect(missing.getCompanyTeam()).resolves.toBeNull();
    expect(called).toBe(false);
  });
});
