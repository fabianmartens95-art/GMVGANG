export const CREATOR_ACTIVATION_SCHEMA_VERSION = "r3-v1.0" as const;

export const DISCLOSURE_ANSWERS = [
  "use_disclosure",
  "follower_threshold",
  "product_link_replaces",
] as const;
export const HEALTH_CLAIM_ANSWERS = [
  "clarify_before_publish",
  "publish_if_good",
  "comments_only",
] as const;
export const RIGHTS_ANSWERS = [
  "rights_required",
  "always_allowed",
  "music_only",
] as const;

export type DisclosureAnswer = typeof DISCLOSURE_ANSWERS[number];
export type HealthClaimAnswer = typeof HEALTH_CLAIM_ANSWERS[number];
export type RightsAnswer = typeof RIGHTS_ANSWERS[number];

export type CreatorActivationInput = {
  shippingCountry: string;
  disclosureAnswer: DisclosureAnswer;
  healthClaimAnswer: HealthClaimAnswer;
  rightsAnswer: RightsAnswer;
};

export type CreatorActivationAssessment = {
  complianceScore: number;
  compliancePassed: boolean;
};

export type CreatorActivation = CreatorActivationInput & CreatorActivationAssessment & {
  id: string;
  creatorProfileId: string;
  schemaVersion: typeof CREATOR_ACTIVATION_SCHEMA_VERSION;
  submittedAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}

export function parseCreatorActivationInput(value: unknown): CreatorActivationInput | null {
  if (!isRecord(value)) return null;
  const shippingCountry = typeof value.shippingCountry === "string" ? value.shippingCountry.trim() : "";
  if (shippingCountry.length < 2 || shippingCountry.length > 80) return null;
  if (!isOneOf(value.disclosureAnswer, DISCLOSURE_ANSWERS)) return null;
  if (!isOneOf(value.healthClaimAnswer, HEALTH_CLAIM_ANSWERS)) return null;
  if (!isOneOf(value.rightsAnswer, RIGHTS_ANSWERS)) return null;

  return {
    shippingCountry,
    disclosureAnswer: value.disclosureAnswer,
    healthClaimAnswer: value.healthClaimAnswer,
    rightsAnswer: value.rightsAnswer,
  };
}

export function assessCreatorActivation(input: CreatorActivationInput): CreatorActivationAssessment {
  const complianceScore = [
    input.disclosureAnswer === "use_disclosure",
    input.healthClaimAnswer === "clarify_before_publish",
    input.rightsAnswer === "rights_required",
  ].filter(Boolean).length;

  return {
    complianceScore,
    compliancePassed: complianceScore === 3,
  };
}
