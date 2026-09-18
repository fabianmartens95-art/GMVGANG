import { describe, expect, it } from "vitest";
import {
  HttpBrandOnboardingEntitlementAdapter,
  parseBrandOnboardingEntitlement,
  renderBrandOnboardingEntitlement,
} from "../src/brand-onboarding-entitlement.js";

const ACTIVE_TRIAL = {
  onboarding: {
    completionPercent: 100,
    complete: true,
    missingFields: [],
    nextBestAction: "onboarding_complete",
  },
  entitlement: {
    mode: "full_access",
    source: "trial",
    plan: null,
    reason: "trial_active",
    trial: {
      status: "active",
      startsAt: "2026-09-18T09:00:00.000Z",
      endsAt: "2026-10-02T09:00:00.000Z",
      daysRemaining: 12,
    },
  },
};

describe("Brand Onboarding & Entitlement surface", () => {
  it("renders server-derived onboarding progress and active Trial without recalculating it", () => {
    const response = parseBrandOnboardingEntitlement(ACTIVE_TRIAL);
    const html = renderBrandOnboardingEntitlement(response);
    expect(html).toContain("100%");
    expect(html).toContain("Trial aktiv · 12 Tag(e) verbleibend.");
    expect(html).toContain("Voller Zugriff");
  });

  it("fails closed on malformed onboarding completion or next action", () => {
    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      onboarding: {
        completionPercent: 80,
        complete: true,
        missingFields: [],
        nextBestAction: "onboarding_complete",
      },
    })).toThrow("BRAND_STATUS_ONBOARDING_INCONSISTENT");

    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      onboarding: {
        completionPercent: 80,
        complete: false,
        missingFields: ["legal_name"],
        nextBestAction: "add_country",
      },
    })).toThrow("BRAND_STATUS_ONBOARDING_INCONSISTENT");
  });

  it("enforces canonical missing-field order and rejects unknown fields", () => {
    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      onboarding: {
        completionPercent: 60,
        complete: false,
        missingFields: ["contact_name", "legal_name"],
        nextBestAction: "add_legal_name",
      },
    })).toThrow("BRAND_STATUS_ONBOARDING_INVALID");

    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      onboarding: {
        completionPercent: 80,
        complete: false,
        missingFields: ["billing_email"],
        nextBestAction: "add_contact_email",
      },
    })).toThrow("BRAND_STATUS_ONBOARDING_INVALID");
  });

  it("fails closed on impossible entitlement combinations", () => {
    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      entitlement: {
        ...ACTIVE_TRIAL.entitlement,
        mode: "read_only",
      },
    })).toThrow("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");

    expect(() => parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      entitlement: {
        mode: "full_access",
        source: "none",
        plan: null,
        reason: "no_entitlement",
        trial: {
          status: "not_started",
          startsAt: null,
          endsAt: null,
          daysRemaining: null,
        },
      },
    })).toThrow("BRAND_STATUS_ENTITLEMENT_INCONSISTENT");
  });

  it("renders expired Trial as read-only while keeping data visibility explicit", () => {
    const response = parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      entitlement: {
        mode: "read_only",
        source: "trial",
        plan: null,
        reason: "trial_expired",
        trial: {
          status: "expired",
          startsAt: "2026-09-18T09:00:00.000Z",
          endsAt: "2026-10-02T09:00:00.000Z",
          daysRemaining: 0,
        },
      },
    });
    const html = renderBrandOnboardingEntitlement(response);
    expect(html).toContain("Read-only");
    expect(html).toContain("Workspace-Daten bleiben lesbar");
  });

  it("accepts active paid plans but no browser billing or upgrade mutation", () => {
    const response = parseBrandOnboardingEntitlement({
      ...ACTIVE_TRIAL,
      entitlement: {
        mode: "full_access",
        source: "paid",
        plan: "brand_growth",
        reason: "paid_plan_active",
        trial: {
          status: "not_started",
          startsAt: null,
          endsAt: null,
          daysRemaining: null,
        },
      },
    });
    const html = renderBrandOnboardingEntitlement(response);
    expect(html).toContain("Brand Growth aktiv.");
    expect(html).not.toContain("checkout");
    expect(html).not.toContain("upgrade");
    expect(html).not.toContain("data-action");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandOnboardingEntitlementAdapter(
      "org-1",
      "/api/brand/onboarding-entitlement",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return ACTIVE_TRIAL; } };
      },
    );

    await expect(adapter.getStatus()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/onboarding-entitlement",
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

  it("does not issue a request without organization context", async () => {
    let called = false;
    const adapter = new HttpBrandOnboardingEntitlementAdapter(
      " ",
      "/api/brand/onboarding-entitlement",
      async () => {
        called = true;
        return { ok: true, async json() { return ACTIVE_TRIAL; } };
      },
    );

    await expect(adapter.getStatus()).resolves.toBeNull();
    expect(called).toBe(false);
  });
});
