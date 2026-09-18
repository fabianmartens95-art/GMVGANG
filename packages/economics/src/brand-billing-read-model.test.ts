import { describe, expect, it } from "vitest";
import { buildBrandBillingReadModel } from "./brand-billing-read-model.js";

const base = {
  organizationId: "org-1",
  billingModel: "revenue_share" as const,
  revenueShareBps: 1500,
  partnerAuthorizationStatus: "authorized" as const,
  history: [
    {
      id: "rev-2026-09",
      kind: "revenue_share" as const,
      status: "settled" as const,
      source: "tiktok_partner_payment" as const,
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-10-01T00:00:00.000Z",
      recordedAt: "2026-10-02T10:00:00.000Z",
      amountCents: 12_345,
      currency: "eur",
      revenueShareBps: 1500,
      reference: "partner-settlement-001",
    },
  ],
};

describe("Brand Billing & Revenue Share read model", () => {
  it("requires an explicit valid revenue share for revenue-share and hybrid models", () => {
    expect(buildBrandBillingReadModel(base)).toMatchObject({
      billingModel: "revenue_share",
      revenueShareBps: 1500,
      partnerAuthorizationStatus: "authorized",
    });

    expect(() => buildBrandBillingReadModel({
      ...base,
      revenueShareBps: null,
    })).toThrow("BRAND_BILLING_SHARE_REQUIRED");

    expect(() => buildBrandBillingReadModel({
      ...base,
      billingModel: "hybrid",
      revenueShareBps: 10001,
    })).toThrow("BRAND_BILLING_SHARE_INVALID");
  });

  it("prevents a retainer-only agreement from silently carrying revenue share", () => {
    expect(() => buildBrandBillingReadModel({
      ...base,
      billingModel: "retainer",
      revenueShareBps: 1500,
    })).toThrow("BRAND_BILLING_RETAINER_SHARE_CONFLICT");

    expect(buildBrandBillingReadModel({
      ...base,
      billingModel: "retainer",
      revenueShareBps: null,
      history: [],
    }).revenueShareBps).toBeNull();
  });

  it("keeps partner authorization independent from the billing model", () => {
    expect(buildBrandBillingReadModel({
      ...base,
      partnerAuthorizationStatus: "not_connected",
    })).toMatchObject({
      billingModel: "revenue_share",
      partnerAuthorizationStatus: "not_connected",
    });
  });

  it("treats history amounts as recorded facts and aggregates only recorded entries", () => {
    const model = buildBrandBillingReadModel({
      ...base,
      history: [
        ...base.history,
        {
          id: "pending-retainer",
          kind: "retainer",
          status: "pending",
          source: "contractual_retainer",
          periodStart: "2026-10-01T00:00:00.000Z",
          periodEnd: "2026-11-01T00:00:00.000Z",
          recordedAt: "2026-10-01T08:00:00.000Z",
          amountCents: 100_000,
          currency: "EUR",
          revenueShareBps: null,
          reference: null,
        },
        {
          id: "credit",
          kind: "adjustment",
          status: "settled",
          source: "manual_reconciliation",
          periodStart: "2026-09-01T00:00:00.000Z",
          periodEnd: "2026-10-01T00:00:00.000Z",
          recordedAt: "2026-10-03T08:00:00.000Z",
          amountCents: -345,
          currency: "EUR",
          revenueShareBps: null,
          reference: "credit-1",
        },
        {
          id: "void-entry",
          kind: "retainer",
          status: "void",
          source: "contractual_retainer",
          periodStart: "2026-11-01T00:00:00.000Z",
          periodEnd: "2026-12-01T00:00:00.000Z",
          recordedAt: "2026-11-01T08:00:00.000Z",
          amountCents: 999_999,
          currency: "EUR",
          revenueShareBps: null,
          reference: null,
        },
      ],
    });

    expect(model.totalsByCurrency).toEqual([
      {
        currency: "EUR",
        pendingCents: 100_000,
        settledCents: 12_000,
      },
    ]);
    expect(model.history[0]?.id).toBe("void-entry");
  });

  it("requires historical revenue-share entries to preserve the recorded rate", () => {
    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{
        ...base.history[0],
        revenueShareBps: null,
      }],
    })).toThrow("BRAND_BILLING_HISTORY_SHARE_REQUIRED");

    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{
        ...base.history[0],
        kind: "retainer",
        revenueShareBps: 1500,
      }],
    })).toThrow("BRAND_BILLING_HISTORY_SHARE_CONFLICT");
  });

  it("fails closed on invalid money, currency, timestamps, and periods", () => {
    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{ ...base.history[0], amountCents: -1 }],
    })).toThrow("BRAND_BILLING_HISTORY_AMOUNT_INVALID");

    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{ ...base.history[0], currency: "EURO" }],
    })).toThrow("BRAND_BILLING_CURRENCY_INVALID");

    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{ ...base.history[0], recordedAt: "invalid" }],
    })).toThrow("BRAND_BILLING_HISTORY_TIMESTAMP_INVALID");

    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [{
        ...base.history[0],
        periodStart: "2026-10-01T00:00:00.000Z",
        periodEnd: "2026-10-01T00:00:00.000Z",
      }],
    })).toThrow("BRAND_BILLING_HISTORY_PERIOD_INVALID");
  });

  it("rejects duplicate history ids", () => {
    expect(() => buildBrandBillingReadModel({
      ...base,
      history: [base.history[0], { ...base.history[0] }],
    })).toThrow("BRAND_BILLING_HISTORY_DUPLICATE_ID");
  });

  it("contains no payment, bank, invoice, or mutation API", async () => {
    const mod = await import("./brand-billing-read-model.js");
    expect(Object.keys(mod).sort()).toEqual(["buildBrandBillingReadModel"]);
  });
});
