import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CreatorRegistrationPorts,
  type CreatorRegistrationAuditSink,
  type CreatorRegistrationIdPort,
} from "@gmvgang/creator-registration";
import type { CreatorProfile, ReferralAttribution } from "@gmvgang/platform-foundation";

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function creatorProfileFromRow(row: Record<string, unknown>): CreatorProfile {
  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.tiktok_handle !== "string" ||
    !["registered", "profile_complete", "qualified", "invited", "contracted", "active", "performing", "rejected", "paused"].includes(String(row.network_status)) ||
    typeof row.profile_completion_percent !== "number" ||
    typeof row.referral_code !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("CREATOR_PROFILE_ROW_INVALID");
  }

  return {
    id: row.id,
    userId: row.user_id,
    ...(typeof row.creator_master_id === "string" && row.creator_master_id ? { creatorMasterId: row.creator_master_id } : {}),
    tiktokHandle: row.tiktok_handle,
    ...(typeof row.display_name === "string" && row.display_name ? { displayName: row.display_name } : {}),
    ...(typeof row.market === "string" && row.market ? { market: row.market } : {}),
    ...(typeof row.language === "string" && row.language ? { language: row.language } : {}),
    ...(Array.isArray(row.niche) && row.niche.every((item) => typeof item === "string") ? { niche: row.niche } : {}),
    networkStatus: row.network_status as CreatorProfile["networkStatus"],
    profileCompletionPercent: row.profile_completion_percent,
    referralCode: row.referral_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

const CREATOR_SELECT = "id,user_id,creator_master_id,tiktok_handle,display_name,market,language,niche,network_status,profile_completion_percent,referral_code,created_at,updated_at";
const REFERRAL_SELECT = "id,referrer_creator_profile_id,referred_creator_profile_id,referral_code,status,attributed_at,qualified_at,contracted_at,activated_at,performing_at,fraud_flags,created_at,updated_at";

function profileWrite(profile: CreatorProfile): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: profile.userId,
    creator_master_id: profile.creatorMasterId ?? null,
    tiktok_handle: profile.tiktokHandle,
    display_name: profile.displayName ?? null,
    market: profile.market ?? null,
    language: profile.language ?? null,
    niche: profile.niche ?? null,
    network_status: profile.networkStatus,
    profile_completion_percent: profile.profileCompletionPercent,
    referral_code: profile.referralCode,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function referralWrite(attribution: ReferralAttribution): Record<string, unknown> {
  return {
    id: attribution.id,
    referrer_creator_profile_id: attribution.referrerCreatorProfileId,
    referred_creator_profile_id: attribution.referredCreatorProfileId,
    referral_code: attribution.referralCode,
    status: attribution.status,
    attributed_at: attribution.attributedAt,
    qualified_at: attribution.qualifiedAt ?? null,
    contracted_at: attribution.contractedAt ?? null,
    activated_at: attribution.activatedAt ?? null,
    performing_at: attribution.performingAt ?? null,
    fraud_flags: attribution.fraudFlags,
    created_at: attribution.createdAt,
    updated_at: attribution.updatedAt,
  };
}

export function createSupabaseRegistrationIds(): CreatorRegistrationIdPort {
  return {
    nextCreatorProfileId: () => randomUUID(),
    nextReferralAttributionId: () => randomUUID(),
    nextReferralCodeCandidate: () => `GMV${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
  };
}

export function createSupabaseCreatorRegistrationPorts(
  client: SupabaseClient,
  ids: CreatorRegistrationIdPort = createSupabaseRegistrationIds(),
): CreatorRegistrationPorts {
  const audit: CreatorRegistrationAuditSink = {
    async record(input) {
      const { error } = await client.from("platform_audit_events").insert({
        event: input.event,
        user_id: input.userId,
        creator_profile_id: input.creatorProfileId,
        occurred_at: input.occurredAt,
        metadata: input.metadata ?? {},
      });
      ensureNoError(error, "AUDIT_INSERT_FAILED");
    },
  };

  return {
    profiles: {
      async findByUserId(userId) {
        const { data, error } = await client.from("creator_profiles").select(CREATOR_SELECT).eq("user_id", userId).maybeSingle();
        ensureNoError(error, "CREATOR_PROFILE_QUERY_FAILED");
        return data ? creatorProfileFromRow(data as Record<string, unknown>) : null;
      },
      async findByTikTokHandle(normalizedHandle) {
        const { data, error } = await client.from("creator_profiles").select(CREATOR_SELECT).eq("tiktok_handle", normalizedHandle).maybeSingle();
        ensureNoError(error, "CREATOR_PROFILE_QUERY_FAILED");
        return data ? creatorProfileFromRow(data as Record<string, unknown>) : null;
      },
      async findByReferralCode(referralCode) {
        const { data, error } = await client.from("creator_profiles").select(CREATOR_SELECT).eq("referral_code", referralCode).maybeSingle();
        ensureNoError(error, "CREATOR_PROFILE_QUERY_FAILED");
        return data ? creatorProfileFromRow(data as Record<string, unknown>) : null;
      },
      async createProfile(profile) {
        const { error } = await client.from("creator_profiles").insert(profileWrite(profile));
        ensureNoError(error, "CREATOR_PROFILE_INSERT_FAILED");
      },
      async updateProfile(profile) {
        const payload = profileWrite(profile);
        delete payload.id;
        delete payload.user_id;
        delete payload.created_at;
        const { error } = await client.from("creator_profiles").update(payload).eq("id", profile.id).eq("user_id", profile.userId);
        ensureNoError(error, "CREATOR_PROFILE_UPDATE_FAILED");
      },
    },
    referrals: {
      async findByReferredCreatorProfileId(creatorProfileId) {
        const { data, error } = await client
          .from("referral_attributions")
          .select(REFERRAL_SELECT)
          .eq("referred_creator_profile_id", creatorProfileId)
          .maybeSingle();
        ensureNoError(error, "REFERRAL_QUERY_FAILED");
        return data ? referralFromRow(data as Record<string, unknown>) : null;
      },
      async listByReferrerCreatorProfileId(creatorProfileId) {
        const { data, error } = await client
          .from("referral_attributions")
          .select(REFERRAL_SELECT)
          .eq("referrer_creator_profile_id", creatorProfileId)
          .order("attributed_at", { ascending: false });
        ensureNoError(error, "REFERRAL_QUERY_FAILED");
        if (!Array.isArray(data)) return [];
        return data.map((row) => referralFromRow(row as Record<string, unknown>));
      },
      async save(attribution) {
        const { error } = await client.from("referral_attributions").insert(referralWrite(attribution));
        ensureNoError(error, "REFERRAL_INSERT_FAILED");
      },
      async update(attribution) {
        const payload = referralWrite(attribution);
        delete payload.id;
        delete payload.referrer_creator_profile_id;
        delete payload.referred_creator_profile_id;
        delete payload.referral_code;
        delete payload.created_at;
        const { error } = await client
          .from("referral_attributions")
          .update(payload)
          .eq("id", attribution.id)
          .eq("referred_creator_profile_id", attribution.referredCreatorProfileId);
        ensureNoError(error, "REFERRAL_UPDATE_FAILED");
      },
    },
    consents: {
      async record(input) {
        const { error } = await client.from("creator_consents").insert({
          user_id: input.userId,
          age_confirmed: input.ageConfirmed,
          privacy_accepted: input.privacyAccepted,
          privacy_notice_version: input.privacyNoticeVersion,
          accepted_at: input.acceptedAt,
        });
        ensureNoError(error, "CREATOR_CONSENT_INSERT_FAILED");
      },
    },
    ids,
    audit,
  };
}