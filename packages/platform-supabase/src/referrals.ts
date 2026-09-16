import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferralAttribution } from "@gmvgang/platform-foundation";

const REFERRAL_SELECT = "id,referrer_creator_profile_id,referred_creator_profile_id,referral_code,status,attributed_at,qualified_at,contracted_at,activated_at,performing_at,fraud_flags,created_at,updated_at";
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 100;

export interface CreatorReferralReadPort {
  listByReferrerCreatorProfileId(creatorProfileId: string): Promise<ReferralAttribution[]>;
}

export type CreatorReferralPageLoader = (input: {
  creatorProfileId: string;
  from: number;
  to: number;
}) => Promise<readonly Record<string, unknown>[]>;

export type CreatorReferralReadOptions = {
  pageSize?: number;
  maxPages?: number;
};

function referralFromRow(row: Record<string, unknown>): ReferralAttribution {
  if (
    typeof row.id !== "string" ||
    typeof row.referrer_creator_profile_id !== "string" ||
    typeof row.referred_creator_profile_id !== "string" ||
    typeof row.referral_code !== "string" ||
    !["attributed", "profile_complete", "qualified", "contracted", "active", "performing", "rejected", "fraud_review"].includes(String(row.status)) ||
    typeof row.attributed_at !== "string" ||
    !Array.isArray(row.fraud_flags) ||
    !row.fraud_flags.every((item) => typeof item === "string") ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("REFERRAL_ATTRIBUTION_ROW_INVALID");
  }

  return {
    id: row.id,
    referrerCreatorProfileId: row.referrer_creator_profile_id,
    referredCreatorProfileId: row.referred_creator_profile_id,
    referralCode: row.referral_code,
    status: row.status as ReferralAttribution["status"],
    attributedAt: row.attributed_at,
    ...(typeof row.qualified_at === "string" && row.qualified_at ? { qualifiedAt: row.qualified_at } : {}),
    ...(typeof row.contracted_at === "string" && row.contracted_at ? { contractedAt: row.contracted_at } : {}),
    ...(typeof row.activated_at === "string" && row.activated_at ? { activatedAt: row.activated_at } : {}),
    ...(typeof row.performing_at === "string" && row.performing_at ? { performingAt: row.performing_at } : {}),
    fraudFlags: row.fraud_flags as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertPaging(options: CreatorReferralReadOptions): { pageSize: number; maxPages: number } {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("CREATOR_REFERRAL_PAGE_SIZE_INVALID");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new Error("CREATOR_REFERRAL_MAX_PAGES_INVALID");
  return { pageSize, maxPages };
}

export async function loadAllCreatorReferrals(
  creatorProfileId: string,
  loadPage: CreatorReferralPageLoader,
  options: CreatorReferralReadOptions = {},
): Promise<ReferralAttribution[]> {
  const ownerId = creatorProfileId.trim();
  if (!ownerId) throw new Error("CREATOR_PROFILE_ID_REQUIRED");
  const { pageSize, maxPages } = assertPaging(options);
  const collected: ReferralAttribution[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const rows = await loadPage({ creatorProfileId: ownerId, from, to: from + pageSize - 1 });
    for (const row of rows) {
      const attribution = referralFromRow(row);
      if (attribution.referrerCreatorProfileId !== ownerId) throw new Error("CREATOR_REFERRAL_OWNER_MISMATCH");
      if (seen.has(attribution.id)) throw new Error("CREATOR_REFERRAL_DUPLICATE_ROW");
      seen.add(attribution.id);
      collected.push(attribution);
    }
    if (rows.length < pageSize) return collected;
  }

  throw new Error("CREATOR_REFERRAL_PAGINATION_LIMIT_REACHED");
}

export function createSupabaseCreatorReferralReadPort(
  client: SupabaseClient,
  options: CreatorReferralReadOptions = {},
): CreatorReferralReadPort {
  return {
    async listByReferrerCreatorProfileId(creatorProfileId) {
      return loadAllCreatorReferrals(
        creatorProfileId,
        async ({ creatorProfileId: ownerId, from, to }) => {
          const { data, error } = await client
            .from("referral_attributions")
            .select(REFERRAL_SELECT)
            .eq("referrer_creator_profile_id", ownerId)
            .order("attributed_at", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to);
          if (error) throw new Error(`CREATOR_REFERRAL_QUERY_FAILED:${error.code ?? "unknown"}`);
          return (data ?? []) as Record<string, unknown>[];
        },
        options,
      );
    },
  };
}
