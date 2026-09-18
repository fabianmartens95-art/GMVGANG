import { describe, expect, it } from "vitest";
import {
  HttpCreatorEarningsAdapter,
  parseCreatorEarningsResponse,
  renderCreatorEarnings,
} from "../src/creator-earnings.js";

const payload = {
  model: {
    generatedAt: "2026-09-18T06:00:00.000Z",
    updatedAt: "2026-09-18T05:45:00.000Z",
    currency: "eur",
    totals: {
      gmvCents: 10000,
      orders: 5,
      recordedCommissionCents: 1500,
    },
    campaigns: [{
      campaignId: "campaign-1",
      campaignName: "Launch <One>",
      gmvCents: 10000,
      orders: 5,
      recordedCommissionCents: 1500,
      updatedAt: "2026-09-18T05:45:00.000Z",
    }],
    settlement: {
      status: "not_available",
      message: "Recorded commission ist kein bestätigter oder ausgezahlter Betrag.",
    },
  },
};

describe("Creator Earnings surface", () => {
  it("parses the recorded-performance contract and normalizes currency/timestamps", () => {
    const response = parseCreatorEarningsResponse(payload);
    expect(response.model.currency).toBe("EUR");
    expect(response.model.totals.recordedCommissionCents).toBe(1500);
    expect(response.model.updatedAt).toBe("2026-09-18T05:45:00.000Z");
  });

  it("fails closed on unknown fields and any premature paid or withdrawable balance claim", () => {
    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        walletBalanceCents: 1500,
      },
    })).toThrow("CREATOR_EARNINGS_MODEL_INVALID");

    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        campaigns: [{
          ...payload.model.campaigns[0],
          payoutStatus: "paid",
        }],
      },
    })).toThrow("CREATOR_EARNINGS_CAMPAIGN_INVALID");


    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        totals: { ...payload.model.totals, withdrawableCents: 1500 },
      },
    })).toThrow("CREATOR_EARNINGS_SETTLEMENT_CLAIM_FORBIDDEN");

    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        settlement: { ...payload.model.settlement, paidCents: 1500 },
      },
    })).toThrow("CREATOR_EARNINGS_SETTLEMENT_CLAIM_FORBIDDEN");
  });

  it("fails closed when totals or freshness contradict Campaign rows", () => {
    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        totals: {
          ...payload.model.totals,
          gmvCents: 9999,
        },
      },
    })).toThrow("CREATOR_EARNINGS_TOTALS_INCONSISTENT");

    expect(() => parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        updatedAt: null,
      },
    })).toThrow("CREATOR_EARNINGS_FRESHNESS_INCONSISTENT");
  });

  it("uses canonical non-payout copy instead of trusting arbitrary server wording", () => {
    const response = parseCreatorEarningsResponse({
      ...payload,
      model: {
        ...payload.model,
        settlement: {
          status: "not_available",
          message: "You may withdraw this now.",
        },
      },
    });

    expect(response.model.settlement.message).toBe(
      "Aufgezeichnete Provisionen sind noch kein bestätigter oder ausgezahlter Betrag.",
    );
  });

  it("renders recorded commission without presenting it as payout", () => {
    const html = renderCreatorEarnings(parseCreatorEarningsResponse(payload));
    expect(html).toContain("Recorded Commission");
    expect(html).toContain("Nicht gleich Auszahlung");
    expect(html).toContain("kein bestätigter oder ausgezahlter Betrag");
    expect(html).not.toContain("withdraw");
    expect(html).toContain("Launch &lt;One&gt;");
  });

  it("keeps the HTTP request account-bound with no Creator id in the browser request", async () => {
    const calls: Array<{ input: string; headers: Record<string, string> }> = [];
    const adapter = new HttpCreatorEarningsAdapter("/api/creator/earnings", async (input, init) => {
      calls.push({ input, headers: init.headers });
      return { ok: true, async json() { return payload; } };
    });

    const result = await adapter.getEarnings();
    expect(result?.model.totals.orders).toBe(5);
    expect(calls).toEqual([{
      input: "/api/creator/earnings",
      headers: { Accept: "application/json" },
    }]);
  });

  it("fails unavailable instead of trusting malformed server data", async () => {
    const adapter = new HttpCreatorEarningsAdapter("/api/creator/earnings", async () => ({
      ok: true,
      async json() { return { model: { paidCents: 99 } }; },
    }));
    await expect(adapter.getEarnings()).resolves.toBeNull();
  });
});
