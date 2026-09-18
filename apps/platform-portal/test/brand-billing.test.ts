import { describe, expect, it } from "vitest";
import {
  HttpBrandBillingAdapter,
  parseBrandBilling,
  renderBrandBilling,
} from "../src/brand-billing.js";

const BILLING = {
  organizationId: "org-1",
  billingModel: "revenue_share",
  revenueShareBps: 1500,
  partnerAuthorizationStatus: "authorized",
  history: [{
    id: "entry-1",
    kind: "revenue_share",
    status: "settled",
    source: "tiktok_partner_payment",
    periodStart: "2026-09-01T00:00:00.000Z",
    periodEnd: "2026-10-01T00:00:00.000Z",
    recordedAt: "2026-10-02T10:00:00.000Z",
    amountCents: 12345,
    currency: "EUR",
    revenueShareBps: 1500,
    reference: "settlement-<1>",
  }],
  totalsByCurrency: [{
    currency: "EUR",
    pendingCents: 0,
    settledCents: 12345,
  }],
};

describe("Brand Billing & Revenue Share surface", () => {
  it("renders explicit agreement, authorization, recorded totals and history", () => {
    const html = renderBrandBilling(parseBrandBilling(BILLING));
    expect(html).toContain("Revenue Share");
    expect(html).toContain("15.00 % Revenue Share");
    expect(html).toContain("Autorisiert");
    expect(html).toContain("Abrechnungshistorie");
    expect(html).toContain("berechnet keine Gebühr aus GMV");
  });

  it("fails closed on unknown billing or authorization states", () => {
    expect(() => parseBrandBilling({ ...BILLING, billingModel: "free" }))
      .toThrow("BRAND_BILLING_SURFACE_STATE_INVALID");
    expect(() => parseBrandBilling({ ...BILLING, partnerAuthorizationStatus: "bank_connected" }))
      .toThrow("BRAND_BILLING_SURFACE_STATE_INVALID");
  });

  it("requires explicit share only for revenue-share/hybrid and rejects retainer conflicts", () => {
    expect(() => parseBrandBilling({ ...BILLING, revenueShareBps: null }))
      .toThrow("BRAND_BILLING_SURFACE_SHARE_REQUIRED");

    expect(() => parseBrandBilling({
      ...BILLING,
      billingModel: "retainer",
      revenueShareBps: 1500,
    })).toThrow("BRAND_BILLING_SURFACE_STATE_INCONSISTENT");
  });

  it("rejects malformed history, totals and duplicate IDs/currencies", () => {
    expect(() => parseBrandBilling({
      ...BILLING,
      history: [BILLING.history[0], { ...BILLING.history[0] }],
    })).toThrow("BRAND_BILLING_SURFACE_HISTORY_DUPLICATE");

    expect(() => parseBrandBilling({
      ...BILLING,
      totalsByCurrency: [BILLING.totalsByCurrency[0], { ...BILLING.totalsByCurrency[0] }],
    })).toThrow("BRAND_BILLING_SURFACE_TOTALS_DUPLICATE");
  });

  it("escapes references and exposes no payment/invoice/bank control", () => {
    const html = renderBrandBilling(parseBrandBilling(BILLING));
    expect(html).toContain("settlement-&lt;1&gt;");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("checkout");
    expect(html).not.toContain("invoice");
    expect(html).not.toContain("bank");
    expect(html).not.toContain("data-action");
  });

  it("keeps organization selection in the authenticated workspace header and rejects tenant mismatch", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpBrandBillingAdapter(
      "org-1",
      "/api/brand/billing",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return BILLING; } };
      },
    );
    await expect(adapter.getBilling()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/billing",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);

    const mismatch = new HttpBrandBillingAdapter(
      "org-2",
      "/api/brand/billing",
      async () => ({ ok: true, async json() { return BILLING; } }),
    );
    await expect(mismatch.getBilling()).resolves.toBeNull();
  });

  it("does not issue a request without organization context", async () => {
    let called = false;
    const adapter = new HttpBrandBillingAdapter(
      " ",
      "/api/brand/billing",
      async () => {
        called = true;
        return { ok: true, async json() { return BILLING; } };
      },
    );
    await expect(adapter.getBilling()).resolves.toBeNull();
    expect(called).toBe(false);
  });
});
