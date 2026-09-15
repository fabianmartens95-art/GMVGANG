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

export async function loadRuntimeSnapshot(): Promise<CockpitRuntimeSnapshot | null> {
  try {
    const response = await fetch("/api/snapshot", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as CockpitRuntimeSnapshot;
  } catch {
    return null;
  }
}
