import type { CampaignLedger } from "@gmvgang/campaign-operations";

export type CreatorPoolSnapshot = {
  total: number;
  active: number;
  onboarding: number;
  screening: number;
  blockers: number;
};

export type CockpitRuntimeSnapshot = {
  generatedAt: string;
  creatorSource: "company-os" | "unavailable";
  campaignSource: "company-os" | "demo";
  creatorPool: CreatorPoolSnapshot | null;
  ledgers: CampaignLedger[];
  syncedAt: {
    creators: string | null;
    campaigns: string | null;
    assignments: string | null;
  };
};

export type SnapshotSource = keyof CockpitRuntimeSnapshot["syncedAt"];

export type SnapshotFreshness = {
  fresh: boolean;
  staleSources: SnapshotSource[];
  oldestAgeMinutes: number | null;
  thresholdMinutes: number;
};

export const DEFAULT_STALE_SYNC_MINUTES = 30;

export function evaluateSnapshotFreshness(
  snapshot: CockpitRuntimeSnapshot | null,
  thresholdMinutes = DEFAULT_STALE_SYNC_MINUTES
): SnapshotFreshness {
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
    throw new Error("thresholdMinutes must be positive");
  }

  if (!snapshot) {
    return {
      fresh: false,
      staleSources: ["creators", "campaigns", "assignments"],
      oldestAgeMinutes: null,
      thresholdMinutes
    };
  }

  const generatedAt = Date.parse(snapshot.generatedAt);
  const requiredSources: SnapshotSource[] = snapshot.campaignSource === "company-os"
    ? ["creators", "campaigns", "assignments"]
    : ["creators"];
  const staleSources: SnapshotSource[] = [];
  let oldestAgeMinutes: number | null = null;

  for (const source of requiredSources) {
    const syncedAt = snapshot.syncedAt[source];
    const parsed = syncedAt ? Date.parse(syncedAt) : Number.NaN;
    if (!Number.isFinite(generatedAt) || !Number.isFinite(parsed)) {
      staleSources.push(source);
      continue;
    }

    const ageMinutes = Math.max(0, (generatedAt - parsed) / 60_000);
    oldestAgeMinutes = oldestAgeMinutes === null ? ageMinutes : Math.max(oldestAgeMinutes, ageMinutes);
    if (ageMinutes > thresholdMinutes) staleSources.push(source);
  }

  return {
    fresh: staleSources.length === 0,
    staleSources,
    oldestAgeMinutes,
    thresholdMinutes
  };
}

export async function loadRuntimeSnapshot(): Promise<CockpitRuntimeSnapshot | null> {
  try {
    const response = await fetch("/api/snapshot", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as CockpitRuntimeSnapshot;
  } catch {
    return null;
  }
}
