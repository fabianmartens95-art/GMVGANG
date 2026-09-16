import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferralRewardRepository } from "@gmvgang/referral-rewards";
import type { ReferralReward } from "@gmvgang/platform-foundation";

const REWARD_SELECT = "id,referral_attribution_id,event,amount_cents,currency,status,approved_at,paid_at,created_at,updated_at";

export function referralRewardFromRow(row: Record<string, unknown>): ReferralReward {
  if (
    typeof row.id !== "string" || !row.id ||
    typeof row.referral_attribution_id !== "string" || !row.referral_attribution_id ||
    !["qualified", "contracted", "first_qualified_performance", "manual_bonus"].includes(String(row.event)) ||
    typeof row.amount_cents !== "number" || !Number.isInteger(row.amount_cents) || row.amount_cents <= 0 ||
    row.currency !== "EUR" ||
    !["pending", "approved", "paid", "rejected", "void"].includes(String(row.status)) ||
    typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
    typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))
  ) {
    throw new Error("REFERRAL_REWARD_ROW_INVALID");
  }

  if (row.approved_at !== null && row.approved_at !== undefined && (typeof row.approved_at !== "string" || !Number.isFinite(Date.parse(row.approved_at)))) {
    throw new Error("REFERRAL_REWARD_ROW_INVALID");
  }
  if (row.paid_at !== null && row.paid_at !== undefined && (typeof row.paid_at !== "string" || !Number.isFinite(Date.parse(row.paid_at)))) {
    throw new Error("REFERRAL_REWARD_ROW_INVALID");
  }

  return {
    id: row.id,
    referralAttributionId: row.referral_attribution_id,
    event: row.event as ReferralReward["event"],
    amountCents: row.amount_cents,
    currency: "EUR",
    status: row.status as ReferralReward["status"],
    ...(typeof row.approved_at === "string" ? { approvedAt: row.approved_at } : {}),
    ...(typeof row.paid_at === "string" ? { paidAt: row.paid_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rewardWrite(reward: ReferralReward): Record<string, unknown> {
  return {
    id: reward.id,
    referral_attribution_id: reward.referralAttributionId,
    event: reward.event,
    amount_cents: reward.amountCents,
    currency: reward.currency,
    status: reward.status,
    approved_at: reward.approvedAt ?? null,
    paid_at: reward.paidAt ?? null,
    created_at: reward.createdAt,
    updated_at: reward.updatedAt,
  };
}

export function createSupabaseReferralRewardRepository(client: SupabaseClient): ReferralRewardRepository {
  return {
    async createIfAbsent(reward) {
      const { error } = await client.from("referral_rewards").insert(rewardWrite(reward));
      if (!error) return { created: true, reward };
      if (error.code !== "23505") throw new Error(`REFERRAL_REWARD_INSERT_FAILED:${error.code ?? "unknown"}`);

      const { data, error: queryError } = await client
        .from("referral_rewards")
        .select(REWARD_SELECT)
        .eq("referral_attribution_id", reward.referralAttributionId)
        .eq("event", reward.event)
        .maybeSingle();
      if (queryError) throw new Error(`REFERRAL_REWARD_QUERY_FAILED:${queryError.code ?? "unknown"}`);
      if (!data) throw new Error("REFERRAL_REWARD_UNIQUE_CONFLICT_WITHOUT_ROW");
      return { created: false, reward: referralRewardFromRow(data as Record<string, unknown>) };
    },
  };
}
