import type { CreatorChannel, CreatorPerformance, CreatorProfile } from "./creator";
import type { CreatorOperationsSnapshot } from "./operations";

export const notionCreatorProperties = {
  name: "TikTok Name",
  handle: "TikTok Handle",
  profileUrl: "Profil URL",
  followers: "Follower",
  averageViewsLast10: "Ø Views letzte 10 Videos",
  accountRegion: "Account-Region",
  audienceRegion: "Haupt-Zielgruppe",
  categories: "Kategorie",
  contentFormats: "Content-Format",
  contentLanguage: "Content-Sprache",
  tier: "Creator-Tier",
  status: "Status",
  intakeStage: "Intake-Stage",
  shopExperience: "TikTok Shop Erfahrung",
  shopGmvBand30d: "TikTok Shop GMV 30 Tage",
  liveExperience: "Live Erfahrung",
  videoCapacity: "Video-Kapazität / Woche",
  liveAvailability: "LIVE-Verfügbarkeit / Woche",
  complianceRisk: "Compliance-Risiko",
  legalHold: "Legal Hold",
  activeViolation: "TikTok Verstöße 90 Tage",
  manualExclusion: "Creator nicht aufnehmen",
  removeCreator: "Raus",
  deletionStatus: "Löschstatus",
  screeningScore: "Screening-Score (manuell)"
} as const;

export type NotionCreatorRow = {
  id: string;
  url?: string | null;
  [key: string]: unknown;
};

export type NotionCreatorImportResult = {
  profile: CreatorProfile | null;
  operations: CreatorOperationsSnapshot;
  warnings: string[];
};

export type NotionCreatorBatchImport = {
  creators: CreatorProfile[];
  operations: CreatorOperationsSnapshot[];
  excludedCreatorIds: string[];
  warnings: Array<{ creatorId: string; code: string }>;
};

export type PerformanceByCreatorId = Record<string, CreatorPerformance | undefined>;

const CATEGORY_ALIASES: Record<string, string> = {
  beauty: "beauty",
  fashion: "fashion",
  lifestyle: "lifestyle",
  food: "food",
  haushalt: "home-living",
  technik: "electronics",
  fitness: "fitness",
  gaming: "gaming",
  familie: "family",
  entertainment: "entertainment",
  "home & living": "home-living",
  electronics: "electronics",
  "health & wellness": "health-wellness",
  sport: "sport",
  pet: "pet",
  sonstiges: "other"
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "__YES__" || value === 1;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) return [];
  const raw = value.trim();

  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  return raw.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeHandle(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.replace(/^@+/, "").trim() || null;
}

function mapMarket(value: string | null): string[] {
  if (!value) return [];
  if (value === "Deutschland") return ["DE"];
  if (value === "EU (andere)") return ["EU"];
  if (value === "Außerhalb EU") return ["NON_EU"];
  return [value];
}

function mapLanguages(value: string | null): string[] {
  if (!value) return [];
  if (value === "Deutsch") return ["de"];
  if (value === "Englisch") return ["en"];
  if (value === "Deutsch & Englisch") return ["de", "en"];
  return [value.toLowerCase()];
}

function mapCategories(value: unknown): string[] {
  return stringArray(value).map((category) => {
    const key = category.toLowerCase();
    return CATEGORY_ALIASES[key] ?? key.replace(/\s+/g, "-");
  });
}

function mapChannels(formats: unknown, liveExperience: string | null): CreatorChannel[] {
  const normalized = stringArray(formats).map((value) => value.toLowerCase());
  const channels = new Set<CreatorChannel>();

  if (normalized.some((value) => value.includes("video") || value === "ugc")) {
    channels.add("video");
  }
  if (normalized.some((value) => value.includes("live"))) {
    channels.add("live");
  }
  if (channels.size === 0 && liveExperience && liveExperience !== "Keine") {
    channels.add("live");
  }

  return [...channels];
}

export function emptyCreatorPerformance(): CreatorPerformance {
  return {
    gmV30d: 0,
    orders30d: 0,
    conversionRate: 0,
    posts30d: 0,
    liveHours30d: 0,
    sampleToPostRate: 0,
    lastActiveAt: null
  };
}

function exclusionReasons(row: NotionCreatorRow): string[] {
  const reasons: string[] = [];
  const status = text(row[notionCreatorProperties.status]);
  const intakeStage = text(row[notionCreatorProperties.intakeStage]);
  const complianceRisk = text(row[notionCreatorProperties.complianceRisk]);
  const activeViolation = text(row[notionCreatorProperties.activeViolation]);
  const deletionStatus = text(row[notionCreatorProperties.deletionStatus]);

  if (booleanValue(row[notionCreatorProperties.legalHold])) reasons.push("legal-hold");
  if (booleanValue(row[notionCreatorProperties.manualExclusion]) || booleanValue(row[notionCreatorProperties.removeCreator])) {
    reasons.push("manual-exclusion");
  }
  if (complianceRisk === "Blocker") reasons.push("compliance-blocker");
  if (activeViolation === "Ja – aktuell aktiv") reasons.push("active-tiktok-violation");
  if (status === "Abgelehnt" || intakeStage === "Abgelehnt") reasons.push("rejected");
  if (deletionStatus === "Löschbereit" || deletionStatus === "Gelöscht/Anonymisiert") {
    reasons.push("retention-blocked");
  }

  return reasons;
}

export function importNotionCreator(
  row: NotionCreatorRow,
  performance?: CreatorPerformance
): NotionCreatorImportResult {
  const warnings: string[] = [];
  const handle = normalizeHandle(row[notionCreatorProperties.handle]);
  const exclusions = exclusionReasons(row);
  const creatorId = row.id;
  const liveExperience = text(row[notionCreatorProperties.liveExperience]);

  if (!performance) warnings.push("performance-not-linked");
  if (!handle) warnings.push("missing-tiktok-handle");

  const operations: CreatorOperationsSnapshot = {
    creatorId,
    source: "notion",
    sourceRecordId: row.id,
    lifecycleStatus: text(row[notionCreatorProperties.status]),
    intakeStage: text(row[notionCreatorProperties.intakeStage]),
    tier: text(row[notionCreatorProperties.tier]),
    profileUrl: text(row[notionCreatorProperties.profileUrl]),
    accountRegion: text(row[notionCreatorProperties.accountRegion]),
    audienceRegion: text(row[notionCreatorProperties.audienceRegion]),
    shopExperience: text(row[notionCreatorProperties.shopExperience]),
    liveExperience,
    shopGmvBand30d: text(row[notionCreatorProperties.shopGmvBand30d]),
    averageViewsLast10: numberValue(row[notionCreatorProperties.averageViewsLast10]),
    screeningScore: numberValue(row[notionCreatorProperties.screeningScore]),
    videoCapacity: text(row[notionCreatorProperties.videoCapacity]),
    liveAvailability: text(row[notionCreatorProperties.liveAvailability]),
    complianceRisk: text(row[notionCreatorProperties.complianceRisk]),
    legalHold: booleanValue(row[notionCreatorProperties.legalHold]),
    eligibleForMatching: exclusions.length === 0 && Boolean(handle),
    exclusionReasons: exclusions
  };

  const profile: CreatorProfile | null = handle ? {
    id: creatorId,
    handle,
    markets: mapMarket(text(row[notionCreatorProperties.accountRegion])),
    languages: mapLanguages(text(row[notionCreatorProperties.contentLanguage])),
    categories: mapCategories(row[notionCreatorProperties.categories]),
    channels: mapChannels(row[notionCreatorProperties.contentFormats], liveExperience),
    followers: numberValue(row[notionCreatorProperties.followers]),
    performance: performance ?? emptyCreatorPerformance()
  } : null;

  return { profile, operations, warnings };
}

export function importNotionCreators(
  rows: NotionCreatorRow[],
  performanceByCreatorId: PerformanceByCreatorId = {}
): NotionCreatorBatchImport {
  const creators: CreatorProfile[] = [];
  const operations: CreatorOperationsSnapshot[] = [];
  const excludedCreatorIds: string[] = [];
  const warnings: Array<{ creatorId: string; code: string }> = [];

  for (const row of rows) {
    const imported = importNotionCreator(row, performanceByCreatorId[row.id]);
    operations.push(imported.operations);
    if (imported.profile) creators.push(imported.profile);
    if (!imported.operations.eligibleForMatching) excludedCreatorIds.push(row.id);
    for (const code of imported.warnings) warnings.push({ creatorId: row.id, code });
  }

  return { creators, operations, excludedCreatorIds, warnings };
}
