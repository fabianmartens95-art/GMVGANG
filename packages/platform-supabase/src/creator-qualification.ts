import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATOR_QUALIFICATION_SCHEMA_VERSION,
  parseCreatorQualificationInput,
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
    typeof row.submitted_at !== "string" ||
    typeof row.updated_at !== "string"
  ) throw new Error("CREATOR_QUALIFICATION_ROW_INVALID");

  const input = parseCreatorQualificationInput({
    shopEnabled: row.shop_enabled,
    shopGmv30dBand: row.shop_gmv_30d_band ?? undefined,
    contentFormats: row.content_formats,
    liveExperience: row.live_experience ?? undefined,
    liveFrequency: row.live_frequency ?? undefined,
    liveConcurrentViewers: row.live_concurrent_viewers ?? undefined,
    productionStyle: row.production_style,
    contentLanguage: row.content_language,
    contentCategories: row.content_categories,
    representativeVideoUrl: row.representative_video_url ?? undefined,
    agencyBinding: row.agency_binding,
    videosPerWeekBand: row.videos_per_week_band,
    sampleTurnaroundBand: row.sample_turnaround_band,
    violationStatus: row.violation_status,
    violationReason: row.violation_reason ?? undefined,
  });
  if (!input) throw new Error("CREATOR_QUALIFICATION_ROW_INVALID");

  return {
    id: row.id,
    creatorProfileId: row.creator_profile_id,
    schemaVersion: CREATOR_QUALIFICATION_SCHEMA_VERSION,
    ...input,
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
      return data ? rowToQualification(data as unknown as Record<string, unknown>) : null;
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
      if (!data) throw new Error("CREATOR_QUALIFICATION_SAVE_FAILED:no_data");
      return rowToQualification(data as unknown as Record<string, unknown>);
    },
  };
}
