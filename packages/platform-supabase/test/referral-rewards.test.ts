import { describe, expect, it } from "vitest";
import { referralRewardFromRow } from "../src/referral-rewards.js";

const ROW = {
  id: "reward-1",
  referral_attribution_id: "attr-1",
  event: "qualified",
  amount_cents: 2500,
  currency: "EUR",
  status: "pending",
  approved_at: null,
  paid_at: null,
  created_at: "2026-09-16T18:00:00.000Z",
  updated_at: "2026-09-16T18:00:00.000Z",
};

describe("referralRewardFromRow", () => {
  it("maps a valid server-side reward row", () => {
    expect(referralRewardFromRow(ROW)).toEqual({
      id: "reward-1",
      referralAttributionId: "attr-1",
      event: "qualified",
      amountCents: 2500,
      currency: "EUR",
      status: "pending",
      createdAt: "2026-09-16T18:00:00.000Z",
      updatedAt: "2026-09-16T18:00:00.000Z",
    });
  });

  it("rejects invalid money, currency and lifecycle values", () => {
    expect(() => referralRewardFromRow({ ...ROW, amount_cents: 0 })).toThrow("REFERRAL_REWARD_ROW_INVALID");
    expect(() => referralRewardFromRow({ ...ROW, currency: "USD" })).toThrow("REFERRAL_REWARD_ROW_INVALID");
    expect(() => referralRewardFromRow({ ...ROW, status: "sending" })).toThrow("REFERRAL_REWARD_ROW_INVALID");
  });

  it("keeps approval and payment timestamps explicit when present", () => {
    expect(referralRewardFromRow({
      ...ROW,
      status: "paid",
      approved_at: "2026-09-16T19:00:00.000Z",
      paid_at: "2026-09-16T20:00:00.000Z",
    })).toMatchObject({
      status: "paid",
      approvedAt: "2026-09-16T19:00:00.000Z",
      paidAt: "2026-09-16T20:00:00.000Z",
    });
  });
});
