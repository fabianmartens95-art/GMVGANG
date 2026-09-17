import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATOR_ACTIVATION_SCHEMA_VERSION,
  assessCreatorActivation,
  parseCreatorActivationInput,
  type CreatorActivation,
  type CreatorActivationInput,
} from "@gmvgang/creator-activation";

const SELECT = [
  "id", "creator_profile_id", "schema_version", "shipping_country", "disclosure_answer",
  "health_claim_answer", "rights_answer", "compliance_score", "compliance_passed",
  "submitted_at", "updated_at",
].join(",");

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function rowToActivation(row: Record<string, unknown>): CreatorActivation {
  if (
    typeof row.id !== "string" ||
    typeof row.creator_profile_id !== "string" ||
    row.schema_version !== CREATOR_ACTIVATION_SCHEMA_VERSION ||
    typeof row.compliance_score !== "number" ||
    typeof row.compliance_passed !== "boolean" ||
    typeof row.submitted_at !== "string" ||
    typeof row.updated_at !== "string"
  ) throw new Error("CREATOR_ACTIVATION_ROW_INVALID");

  const input = parseCreatorActivationInput({
    shippingCountry: row.shipping_country,
    disclosureAnswer: row.disclosure_answer,
    healthClaimAnswer: row.health_claim_answer,
    rightsAnswer: row.rights_answer,
  });
  if (!input) throw new Error("CREATOR_ACTIVATION_ROW_INVALID");
  const assessment = assessCreatorActivation(input);
  if (
    assessment.complianceScore !== row.compliance_score ||
    assessment.compliancePassed !== row.compliance_passed
  ) throw new Error("CREATOR_ACTIVATION_ROW_INVALID");

  return {
    id: row.id,
    creatorProfileId: row.creator_profile_id,
    schemaVersion: CREATOR_ACTIVATION_SCHEMA_VERSION,
    ...input,
    ...assessment,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

function write(
  creatorProfileId: string,
  input: CreatorActivationInput,
  submittedAt: string,
  updatedAt: string,
): Record<string, unknown> {
  const assessment = assessCreatorActivation(input);
  return {
    creator_profile_id: creatorProfileId,
    schema_version: CREATOR_ACTIVATION_SCHEMA_VERSION,
    shipping_country: input.shippingCountry,
    disclosure_answer: input.disclosureAnswer,
    health_claim_answer: input.healthClaimAnswer,
    rights_answer: input.rightsAnswer,
    compliance_score: assessment.complianceScore,
    compliance_passed: assessment.compliancePassed,
    submitted_at: submittedAt,
    updated_at: updatedAt,
  };
}

export type CreatorActivationStore = {
  findByCreatorProfileId(creatorProfileId: string): Promise<CreatorActivation | null>;
  save(input: {
    creatorProfileId: string;
    activation: CreatorActivationInput;
    now: string;
  }): Promise<CreatorActivation>;
};

export function createSupabaseCreatorActivationStore(client: SupabaseClient): CreatorActivationStore {
  return {
    async findByCreatorProfileId(creatorProfileId) {
      const { data, error } = await client
        .from("creator_activations")
        .select(SELECT)
        .eq("creator_profile_id", creatorProfileId)
        .maybeSingle();
      ensureNoError(error, "CREATOR_ACTIVATION_QUERY_FAILED");
      return data ? rowToActivation(data as unknown as Record<string, unknown>) : null;
    },
    async save({ creatorProfileId, activation, now }) {
      const existing = await this.findByCreatorProfileId(creatorProfileId);
      const payload = write(creatorProfileId, activation, existing?.submittedAt ?? now, now);
      const { data, error } = await client
        .from("creator_activations")
        .upsert(payload, { onConflict: "creator_profile_id" })
        .select(SELECT)
        .single();
      ensureNoError(error, "CREATOR_ACTIVATION_SAVE_FAILED");
      if (!data) throw new Error("CREATOR_ACTIVATION_SAVE_FAILED:no_data");
      return rowToActivation(data as unknown as Record<string, unknown>);
    },
  };
}
