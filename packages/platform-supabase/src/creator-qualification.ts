import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATOR_QUALIFICATION_SCHEMA_VERSION,
  type CreatorQualification,
  type CreatorQualificationInput,
} from "@gmvgang/creator-qualification";

const SELECT = [
  "id", "creator_profile_id", "schema_version", "shop_enabled", "shop_gmv_30d_band", "content_formats",
  "live_experience", "live_frequency", "live_concurrent_viewers", "production_style", "content_language",
  "content_categories", "representative_video_url", "agency_binding", "videos_per_week_band",
  "sample_turnaround_band", "violation_status", "violation_reason", "submitted_at", "updated_at",
].join(",");

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function rowToQualification(row: Record<string, unknown>): CreatorQualification {
  if (
    typeof row.id !== "string" ||
    typeof row.creator_profile_id !== "string" ||
    row.schema_version !== CREATOR_QUALIFICATION_SCHEMA_VERSION ||
    typeof row.shop_enabled !== "string" ||
    !Array.isArray(row.content_formats) ||
    typeof row.production_style !== "string" ||
    typeof row.content_language !== "string" ||
    !Array.isArray(row.content_categories) ||
    typeof row.agency_binding !== "string" ||
    typeof row.videos_per_week_band !== "string" ||
    typeof row.sample_turnaround_band !== "string" ||
    typeof row.violation_status !== "string" ||
    typeof row.submitted_at !== "string" ||
    typeof row.updated_at !== "string"
  ) throw new Error("CREATOR_QUALIFICATION_ROW_INVALID");

  return {
    id: row.id,
    creatorProfileId: row.creator_profile_id,
    schemaVersion: CREATOR_QUALIFICATION_SCHEMA_VERSION,
    shopEnabled: row.shop_enabled as CreatorQualification["shopEnabled"],
    ...(typeof row.shop_gmv_30d_band === "string" ? { shopGmv30dBand: row.shop_gmv_30d_band as CreatorQualification["shopGmv30dBand"] } : {}),
    contentFormats: row.content_formats as CreatorQualification["contentFormats"],
    ...(typeof row.live_experience === "string" ? { liveExperience: row.live_experience as CreatorQualification["liveExperience"] } : {}),
    ...(typeof row.live_frequency === "string" ? { liveFrequency: row.live_frequency as CreatorQualification["liveFrequency"] } : {}),
    ...(typeof row.live_concurrent_viewers === "string" ? { liveConcurrentViewers: row.live_concurrent_viewers as CreatorQualification["liveConcurrentViewers"] } : {}),
    productionStyle: row.production_style as CreatorQualification["productionStyle"],
    contentLanguage: row.content_language as CreatorQualification["contentLanguage"],
    contentCategories: row.content_categories as CreatorQualification["contentCategories"],
    ...(typeof row.representative_video_url === "string" && row.representative_video_url ? { representativeVideoUrl: row.representative_video_url } : {}),
    agencyBinding: row.agency_binding as CreatorQualification["agencyBinding"],
    videosPerWeekBand: row.videos_per_week_band as CreatorQualification["videosPerWeekBand"],
    sampleTurnaroundBand: row.sample_turnaround_band as CreatorQualification["sampleTurnaroundBand"],
    violationStatus: row.violation_status as CreatorQualification["violationStatus"],
    ...(typeof row.violation_reason === "string" && row.violation_reason ? { violationReason: row.violation_reason } : {}),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

function write(creatorProfileId: string, input: CreatorQualificationInput, submittedAt: string, updatedAt: string) {
  return {
    creator_profile_id: creatorProfileId,
    schema_version: CREATOR_QUALIFICATION_SCHEMA_VERSION,
    shop_enabled: input.shopEnabled,
    shop_gmv_30d_band: input.shopGmv30dBand ?? null,
    content_formats: input.contentFormats,
    live_experience: input.liveExperience ?? null,
    live_frequency: input.liveFrequency ?? null,
    live_concurrent_viewers: input.liveConcurrentViewers ?? null,
    production_style: input.productionStyle,
    content_language: input.contentLanguage,
    content_categories: input.contentCategories,
    representative_video_url: input.representativeVideoUrl ?? null,
    agency_binding: input.agencyBinding,
    videos_per_week_band: input.videosPerWeekBand,
    sample_turnaround_band: input.sampleTurnaroundBand,
    violation_status: input.violationStatus,
    violation_reason: input.violationReason ?? null,
    submitted_at: submittedAt,
    updated_at: updatedAt,
  };
}

export type CreatorQualificationStore = {
  findByCreatorProfileId(creatorProfileId: string): Promise<CreatorQualification | null>;
  save(input: { creatorProfileId: string; qualification: CreatorQualificationInput; now: string }): Promise<CreatorQualification>;
};

export function createSupabaseCreatorQualificationStore(client: SupabaseClient): CreatorQualificationStore {
  return {
    async findByCreatorProfileId(creatorProfileId) {
      const { data, error } = await client
        .from("creator_qualifications")
        .select(SELECT)
        .eq("creator_profile_id", creatorProfileId)
        .maybeSingle();
      ensureNoError(error, "CREATOR_QUALIFICATION_QUERY_FAILED");
      return data ? rowToQualification(data as Record<string, unknown>) : null;
    },
    async save({ creatorProfileId, qualification, now }) {
      const existing = await this.findByCreatorProfileId(creatorProfileId);
      const payload = write(creatorProfileId, qualification, existing?.submittedAt ?? now, now);
      const { data, error } = await client
        .from("creator_qualifications")
        .upsert(payload, { onConflict: "creator_profile_id" })
        .select(SELECT)
        .single();
      ensureNoError(error, "CREATOR_QUALIFICATION_SAVE_FAILED");
      return rowToQualification(data as Record<string, unknown>);
    },
  };
}
