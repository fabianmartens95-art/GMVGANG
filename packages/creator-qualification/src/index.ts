export const CREATOR_QUALIFICATION_SCHEMA_VERSION = "r2-v3.0" as const;

export const CREATOR_SHOP_ENABLED = ["yes", "no", "unknown"] as const;
export const CREATOR_SHOP_GMV_30D_BANDS = ["none", "lt_500", "500_2500", "2500_10000", "10000_plus"] as const;
export const CREATOR_CONTENT_FORMATS = ["shoppable_video", "live_shopping", "ugc", "entertainment_community"] as const;
export const CREATOR_LIVE_EXPERIENCE = ["none", "basic", "experienced", "pro"] as const;
export const CREATOR_LIVE_FREQUENCY = ["none", "weekly_1", "weekly_2_3", "weekly_4_plus"] as const;
export const CREATOR_LIVE_CONCURRENT_VIEWERS = ["not_live", "lt_25", "25_100", "100_500", "500_plus"] as const;
export const CREATOR_PRODUCTION_STYLES = ["faceless", "face", "mixed"] as const;
export const CREATOR_CONTENT_LANGUAGES = ["de", "en", "de_en", "other"] as const;
export const CREATOR_CONTENT_CATEGORIES = [
  "beauty", "fashion", "lifestyle", "food", "tech", "fitness", "gaming", "family",
  "entertainment", "home_living", "health_wellness", "pet", "other",
] as const;
export const CREATOR_AGENCY_BINDINGS = ["none", "non_exclusive", "exclusive", "unsure"] as const;
export const CREATOR_VIDEOS_PER_WEEK = ["weekly_1_2", "weekly_3_5", "weekly_6_plus", "open"] as const;
export const CREATOR_SAMPLE_TURNAROUND = ["days_3_5", "days_6_7", "days_8_14", "gt_14"] as const;
export const CREATOR_VIOLATION_STATUS = ["none", "resolved", "active", "unsure"] as const;

type ValueOf<T extends readonly string[]> = T[number];
export type CreatorShopEnabled = ValueOf<typeof CREATOR_SHOP_ENABLED>;
export type CreatorShopGmv30dBand = ValueOf<typeof CREATOR_SHOP_GMV_30D_BANDS>;
export type CreatorContentFormat = ValueOf<typeof CREATOR_CONTENT_FORMATS>;
export type CreatorLiveExperience = ValueOf<typeof CREATOR_LIVE_EXPERIENCE>;
export type CreatorLiveFrequency = ValueOf<typeof CREATOR_LIVE_FREQUENCY>;
export type CreatorLiveConcurrentViewers = ValueOf<typeof CREATOR_LIVE_CONCURRENT_VIEWERS>;
export type CreatorProductionStyle = ValueOf<typeof CREATOR_PRODUCTION_STYLES>;
export type CreatorContentLanguage = ValueOf<typeof CREATOR_CONTENT_LANGUAGES>;
export type CreatorContentCategory = ValueOf<typeof CREATOR_CONTENT_CATEGORIES>;
export type CreatorAgencyBinding = ValueOf<typeof CREATOR_AGENCY_BINDINGS>;
export type CreatorVideosPerWeekBand = ValueOf<typeof CREATOR_VIDEOS_PER_WEEK>;
export type CreatorSampleTurnaroundBand = ValueOf<typeof CREATOR_SAMPLE_TURNAROUND>;
export type CreatorViolationStatus = ValueOf<typeof CREATOR_VIOLATION_STATUS>;

export type CreatorQualificationInput = {
  shopEnabled: CreatorShopEnabled;
  shopGmv30dBand?: CreatorShopGmv30dBand;
  contentFormats: CreatorContentFormat[];
  liveExperience?: CreatorLiveExperience;
  liveFrequency?: CreatorLiveFrequency;
  liveConcurrentViewers?: CreatorLiveConcurrentViewers;
  productionStyle: CreatorProductionStyle;
  contentLanguage: CreatorContentLanguage;
  contentCategories: CreatorContentCategory[];
  representativeVideoUrl?: string;
  agencyBinding: CreatorAgencyBinding;
  videosPerWeekBand: CreatorVideosPerWeekBand;
  sampleTurnaroundBand: CreatorSampleTurnaroundBand;
  violationStatus: CreatorViolationStatus;
  violationReason?: string;
};

export type CreatorQualification = CreatorQualificationInput & {
  id: string;
  creatorProfileId: string;
  schemaVersion: typeof CREATOR_QUALIFICATION_SCHEMA_VERSION;
  submittedAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T): ValueOf<T> | null {
  return typeof value === "string" && allowed.includes(value as ValueOf<T>) ? value as ValueOf<T> : null;
}

function enumList<T extends readonly string[]>(value: unknown, allowed: T, min: number, max: number): ValueOf<T>[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null;
  if (!value.every((item) => typeof item === "string" && allowed.includes(item as ValueOf<T>))) return null;
  const unique = [...new Set(value as ValueOf<T>[])];
  return unique.length === value.length ? unique : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function validTikTokUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && (host === "tiktok.com" || host.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

export function parseCreatorQualificationInput(value: unknown): CreatorQualificationInput | null {
  if (!isRecord(value)) return null;

  const shopEnabled = enumValue(value.shopEnabled, CREATOR_SHOP_ENABLED);
  const contentFormats = enumList(value.contentFormats, CREATOR_CONTENT_FORMATS, 1, 4);
  const productionStyle = enumValue(value.productionStyle, CREATOR_PRODUCTION_STYLES);
  const contentLanguage = enumValue(value.contentLanguage, CREATOR_CONTENT_LANGUAGES);
  const contentCategories = enumList(value.contentCategories, CREATOR_CONTENT_CATEGORIES, 1, 3);
  const agencyBinding = enumValue(value.agencyBinding, CREATOR_AGENCY_BINDINGS);
  const videosPerWeekBand = enumValue(value.videosPerWeekBand, CREATOR_VIDEOS_PER_WEEK);
  const sampleTurnaroundBand = enumValue(value.sampleTurnaroundBand, CREATOR_SAMPLE_TURNAROUND);
  const violationStatus = enumValue(value.violationStatus, CREATOR_VIOLATION_STATUS);

  if (!shopEnabled || !contentFormats || !productionStyle || !contentLanguage || !contentCategories ||
      !agencyBinding || !videosPerWeekBand || !sampleTurnaroundBand || !violationStatus) return null;

  const shopGmv30dBand = enumValue(value.shopGmv30dBand, CREATOR_SHOP_GMV_30D_BANDS);
  if (shopEnabled === "yes" && !shopGmv30dBand) return null;
  if (shopEnabled !== "yes" && value.shopGmv30dBand !== undefined && value.shopGmv30dBand !== null && value.shopGmv30dBand !== "") return null;

  const hasLive = contentFormats.includes("live_shopping");
  const liveExperience = enumValue(value.liveExperience, CREATOR_LIVE_EXPERIENCE);
  const liveFrequency = enumValue(value.liveFrequency, CREATOR_LIVE_FREQUENCY);
  const liveConcurrentViewers = enumValue(value.liveConcurrentViewers, CREATOR_LIVE_CONCURRENT_VIEWERS);
  if (hasLive && (!liveExperience || !liveFrequency || !liveConcurrentViewers)) return null;
  if (!hasLive && [value.liveExperience, value.liveFrequency, value.liveConcurrentViewers].some((item) => item !== undefined && item !== null && item !== "")) return null;

  const representativeVideoUrl = optionalText(value.representativeVideoUrl, 2048);
  if (representativeVideoUrl === null || (representativeVideoUrl && !validTikTokUrl(representativeVideoUrl))) return null;

  const violationReason = optionalText(value.violationReason, 500);
  if (violationReason === null) return null;
  if (violationStatus === "none" && violationReason) return null;
  if (violationStatus !== "none" && !violationReason) return null;

  return {
    shopEnabled,
    ...(shopEnabled === "yes" && shopGmv30dBand ? { shopGmv30dBand } : {}),
    contentFormats,
    ...(hasLive && liveExperience && liveFrequency && liveConcurrentViewers
      ? { liveExperience, liveFrequency, liveConcurrentViewers }
      : {}),
    productionStyle,
    contentLanguage,
    contentCategories,
    ...(representativeVideoUrl ? { representativeVideoUrl } : {}),
    agencyBinding,
    videosPerWeekBand,
    sampleTurnaroundBand,
    violationStatus,
    ...(violationReason ? { violationReason } : {}),
  };
}
