export type CreatorBrandProfileSource = {
  creatorProfileId: string;
  displayName?: string | null;
  tiktokHandle: string;
  market?: string | null;
  language?: string | null;
  niches?: string[] | null;
  verificationStatus?: "unverified" | "pending_review" | "verified" | "rejected";
  performance?: {
    gmVCents?: number | null;
    orders?: number | null;
    postedContent?: number | null;
    updatedAt?: string | null;
  } | null;

  // Internal/source-only fields intentionally excluded from output.
  email?: string | null;
  referralCode?: string | null;
  creatorMasterId?: string | null;
  userId?: string | null;
  internalNotes?: string | null;
};

export type CreatorBrandPublicProfile = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  market: string | null;
  language: string | null;
  niches: string[];
  verification: "verified" | "not_verified";
  performance: {
    gmVCents: number | null;
    orders: number | null;
    postedContent: number | null;
    updatedAt: string | null;
  };
};

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function nonNegativeOrNull(value: number | null | undefined, code: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

export function toCreatorBrandPublicProfile(
  source: CreatorBrandProfileSource,
): CreatorBrandPublicProfile {
  const creatorProfileId = source.creatorProfileId.trim();
  const tiktokHandle = source.tiktokHandle.trim();
  const displayName = source.displayName?.trim() || tiktokHandle;

  if (!creatorProfileId) throw new Error("CREATOR_PUBLIC_PROFILE_ID_REQUIRED");
  if (!tiktokHandle) throw new Error("CREATOR_PUBLIC_TIKTOK_HANDLE_REQUIRED");

  const niches = [...new Set((source.niches ?? []).map((item) => item.trim()).filter(Boolean))];

  const updatedAt = cleanOptional(source.performance?.updatedAt);
  if (updatedAt && !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error("CREATOR_PUBLIC_PERFORMANCE_TIMESTAMP_INVALID");
  }

  return {
    creatorProfileId,
    displayName,
    tiktokHandle,
    market: cleanOptional(source.market),
    language: cleanOptional(source.language),
    niches,
    verification: source.verificationStatus === "verified" ? "verified" : "not_verified",
    performance: {
      gmVCents: nonNegativeOrNull(source.performance?.gmVCents, "CREATOR_PUBLIC_GMV_INVALID"),
      orders: nonNegativeOrNull(source.performance?.orders, "CREATOR_PUBLIC_ORDERS_INVALID"),
      postedContent: nonNegativeOrNull(
        source.performance?.postedContent,
        "CREATOR_PUBLIC_POSTED_CONTENT_INVALID",
      ),
      updatedAt,
    },
  };
}
