import type { CreatorNetworkStatus, CreatorProfile } from "./types.js";

export interface CreatorProfileCompletionInput {
  tiktokHandle?: string;
  displayName?: string;
  market?: string;
  language?: string;
  niche?: readonly string[];
}

export function creatorProfileCompletionPercent(input: CreatorProfileCompletionInput): number {
  const checks = [
    Boolean(input.tiktokHandle?.trim()),
    Boolean(input.displayName?.trim()),
    Boolean(input.market?.trim()),
    Boolean(input.language?.trim()),
    Boolean(input.niche?.length),
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

const CREATOR_STATUS_ORDER: CreatorNetworkStatus[] = [
  "registered",
  "profile_complete",
  "qualified",
  "invited",
  "contracted",
  "active",
  "performing",
];

export function canTransitionCreatorStatus(from: CreatorNetworkStatus, to: CreatorNetworkStatus): boolean {
  if (to === "rejected" || to === "paused") return true;
  if (from === "rejected") return false;
  if (from === "paused") return to === "active";

  const fromIndex = CREATOR_STATUS_ORDER.indexOf(from);
  const toIndex = CREATOR_STATUS_ORDER.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0 && toIndex === fromIndex + 1;
}

export function transitionCreatorStatus(profile: CreatorProfile, to: CreatorNetworkStatus, now: string): CreatorProfile {
  if (!canTransitionCreatorStatus(profile.networkStatus, to)) {
    throw new Error("INVALID_CREATOR_STATUS_TRANSITION");
  }

  if (to === "profile_complete" && profile.profileCompletionPercent < 100) {
    throw new Error("CREATOR_PROFILE_INCOMPLETE");
  }

  return { ...profile, networkStatus: to, updatedAt: now };
}

export function normalizeTikTokHandle(value: string): string {
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  if (!normalized) throw new Error("TIKTOK_HANDLE_REQUIRED");
  return normalized;
}
