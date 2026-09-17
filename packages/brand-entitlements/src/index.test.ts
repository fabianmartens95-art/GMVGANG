import { describe, expect, it } from "vitest";

import {
  brandPlanHasCapability,
  canMutateBrandWorkspace,
  capabilitiesForBrandPlan,
  createBrandTrial,
  DEFAULT_BRAND_TRIAL_DAYS,
  resolveBrandEntitlement,
} from "./index.js";

describe("Brand entitlements", () => {
  it("starts the default 14-day trial only after onboarding completion", () => {
    const trial = createBrandTrial({
      onboardingCompletedAt: "2026-09-18T08:00:00.000Z",
      now: "2026-09-18T09:00:00.000Z",
    });

    expect(DEFAULT_BRAND_TRIAL_DAYS).toBe(14);
    expect(trial.trialStartedAt).toBe("2026-09-18T09:00:00.000Z");
    expect(trial.trialEndsAt).toBe("2026-10-02T09:00:00.000Z");

    expect(() => createBrandTrial({
      onboardingCompletedAt: "2026-09-18T10:00:00.000Z",
      now: "2026-09-18T09:00:00.000Z",
    })).toThrow("BRAND_TRIAL_BEFORE_ONBOARDING_COMPLETION");
  });

  it("gives full access during an active trial", () => {
    const model = resolveBrandEntitlement({
      kind: "trial",
      onboardingCompletedAt: "2026-09-18T08:00:00.000Z",
      trialStartedAt: "2026-09-18T09:00:00.000Z",
      trialEndsAt: "2026-10-02T09:00:00.000Z",
    }, "2026-09-20T09:00:00.000Z");

    expect(model.mode).toBe("full_access");
    expect(model.reason).toBe("trial_active");
    expect(model.trial.daysRemaining).toBe(12);
    expect(canMutateBrandWorkspace({
      kind: "trial",
      onboardingCompletedAt: "2026-09-18T08:00:00.000Z",
      trialStartedAt: "2026-09-18T09:00:00.000Z",
      trialEndsAt: "2026-10-02T09:00:00.000Z",
    }, "2026-09-20T09:00:00.000Z")).toBe(true);
  });

  it("switches an expired trial to read-only without deleting entitlement context", () => {
    const model = resolveBrandEntitlement({
      kind: "trial",
      onboardingCompletedAt: "2026-09-18T08:00:00.000Z",
      trialStartedAt: "2026-09-18T09:00:00.000Z",
      trialEndsAt: "2026-10-02T09:00:00.000Z",
    }, "2026-10-02T09:00:00.000Z");

    expect(model).toMatchObject({
      mode: "read_only",
      source: "trial",
      reason: "trial_expired",
      trial: {
        status: "expired",
        startsAt: "2026-09-18T09:00:00.000Z",
        endsAt: "2026-10-02T09:00:00.000Z",
        daysRemaining: 0,
      },
    });
  });

  it("gives an active paid plan full access and keeps plan identity explicit", () => {
    const model = resolveBrandEntitlement({
      kind: "paid",
      plan: "brand_growth",
      startsAt: "2026-09-18T00:00:00.000Z",
      endsAt: null,
    }, "2026-09-30T00:00:00.000Z");

    expect(model).toMatchObject({
      mode: "full_access",
      source: "paid",
      plan: "brand_growth",
      reason: "paid_plan_active",
    });
  });

  it("fails closed to read-only when there is no active entitlement", () => {
    expect(resolveBrandEntitlement({ kind: "none" }, "2026-09-18T00:00:00.000Z"))
      .toMatchObject({
        mode: "read_only",
        source: "none",
        reason: "no_entitlement",
      });

    expect(resolveBrandEntitlement({
      kind: "paid",
      plan: "brand_core",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-09-10T00:00:00.000Z",
    }, "2026-09-18T00:00:00.000Z").mode).toBe("read_only");
  });
});

describe("Brand plan capabilities", () => {
  it("keeps Brand Core focused on self-service essentials", () => {
    expect(capabilitiesForBrandPlan("brand_core")).toEqual([
      "workspace.write",
      "products.manage",
      "campaigns.manage",
      "creator_discovery.read",
      "analytics.basic",
    ]);
    expect(brandPlanHasCapability("brand_core", "profitability.read")).toBe(false);
  });

  it("adds profitability, automation and priority support in Brand Growth", () => {
    expect(brandPlanHasCapability("brand_growth", "profitability.read")).toBe(true);
    expect(brandPlanHasCapability("brand_growth", "automations.use")).toBe(true);
    expect(brandPlanHasCapability("brand_growth", "priority_support")).toBe(true);
    expect(brandPlanHasCapability("brand_growth", "managed_operations")).toBe(false);
  });

  it("adds managed operations only to Managed Growth", () => {
    expect(brandPlanHasCapability("managed_growth", "managed_operations")).toBe(true);
    expect(brandPlanHasCapability("brand_core", "managed_operations")).toBe(false);
  });

  it("keeps Enterprise-specific team, integration and SLA capabilities explicit", () => {
    expect(brandPlanHasCapability("enterprise", "teams.advanced")).toBe(true);
    expect(brandPlanHasCapability("enterprise", "integrations.custom")).toBe(true);
    expect(brandPlanHasCapability("enterprise", "sla")).toBe(true);
  });
});
