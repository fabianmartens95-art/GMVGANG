import type {
  TeamCreatorActivityItem,
  TeamCreatorFunnelItem,
  TeamCreatorFunnelReadModel,
  TeamCreatorFunnelStep,
} from "./types.js";

const INTERNAL_ROLES = new Set(["founder", "admin", "creator_manager", "brand_manager", "closer"]);
const CREATOR_EVENT_PREFIX = "creator.";

export type TeamCreatorFunnelSource = {
  users: Array<{ id: string; email: string | null; is_test_account: boolean; created_at: string; updated_at: string }>;
  profiles: Array<{
    id: string;
    user_id: string;
    tiktok_handle: string | null;
    display_name: string | null;
    network_status: string | null;
    profile_completion_percent: number | null;
    created_at: string;
    updated_at: string;
  }>;
  qualifications: Array<{
    creator_profile_id: string;
    submitted_at: string;
    updated_at: string;
  }>;
  memberships: Array<{
    user_id: string;
    role: string;
    status: string;
  }>;
  analytics: Array<{
    user_id: string;
    event_name: string;
    path: string;
    occurred_at: string;
  }>;
  audit: Array<{
    user_id: string | null;
    event: string;
    occurred_at: string;
  }>;
};

function time(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latest(values: Array<string | null | undefined>): string {
  return values.reduce<string>((winner, value) => time(value) > time(winner) ? String(value) : winner, "");
}

function currentStep(profile: TeamCreatorFunnelSource["profiles"][number] | undefined, qualified: boolean): TeamCreatorFunnelStep {
  if (qualified) return "complete";
  if (!profile) return "registered";
  if ((profile.profile_completion_percent ?? 0) >= 100 || profile.network_status === "profile_complete") {
    return "qualification";
  }
  return "profile";
}

function sortActivity(items: TeamCreatorActivityItem[]): TeamCreatorActivityItem[] {
  return items
    .sort((a, b) => time(b.occurredAt) - time(a.occurredAt))
    .slice(0, 12);
}

export function buildTeamCreatorFunnelReadModel(
  source: TeamCreatorFunnelSource,
  now: string,
  stalledAfterMinutes = 30,
): TeamCreatorFunnelReadModel {
  const profileByUser = new Map(source.profiles.map((profile) => [profile.user_id, profile]));
  const qualificationByProfile = new Map(source.qualifications.map((qualification) => [qualification.creator_profile_id, qualification]));
  const membershipsByUser = new Map<string, TeamCreatorFunnelSource["memberships"]>();
  for (const membership of source.memberships) {
    const memberships = membershipsByUser.get(membership.user_id) ?? [];
    memberships.push(membership);
    membershipsByUser.set(membership.user_id, memberships);
  }

  const analyticsByUser = new Map<string, TeamCreatorFunnelSource["analytics"]>();
  for (const event of source.analytics) {
    const events = analyticsByUser.get(event.user_id) ?? [];
    events.push(event);
    analyticsByUser.set(event.user_id, events);
  }

  const auditByUser = new Map<string, TeamCreatorFunnelSource["audit"]>();
  for (const event of source.audit) {
    if (!event.user_id) continue;
    const events = auditByUser.get(event.user_id) ?? [];
    events.push(event);
    auditByUser.set(event.user_id, events);
  }

  const nowMs = time(now);
  const stalledAfterMs = stalledAfterMinutes * 60_000;
  const dayAgo = nowMs - 24 * 60 * 60_000;

  const creators: TeamCreatorFunnelItem[] = [];
  for (const user of source.users) {
    if (user.is_test_account) continue;

    const memberships = membershipsByUser.get(user.id) ?? [];
    const activeRoles = memberships.filter((membership) => membership.status === "active").map((membership) => membership.role);
    if (activeRoles.some((role) => INTERNAL_ROLES.has(role))) continue;

    const profile = profileByUser.get(user.id);
    const analytics = analyticsByUser.get(user.id) ?? [];
    const audit = auditByUser.get(user.id) ?? [];
    const creatorIntent = activeRoles.includes("creator") || Boolean(profile) ||
      analytics.some((event) => event.event_name.startsWith(CREATOR_EVENT_PREFIX)) ||
      audit.some((event) => event.event.startsWith(CREATOR_EVENT_PREFIX));
    if (!creatorIntent) continue;

    const qualification = profile ? qualificationByProfile.get(profile.id) : undefined;
    const activity = sortActivity([
      ...analytics.map((event): TeamCreatorActivityItem => ({
        source: "analytics",
        event: event.event_name,
        occurredAt: event.occurred_at,
        ...(event.path ? { path: event.path } : {}),
      })),
      ...audit.map((event): TeamCreatorActivityItem => ({
        source: "audit",
        event: event.event,
        occurredAt: event.occurred_at,
      })),
    ]);

    const lastActivityAt = latest([
      user.updated_at,
      user.created_at,
      profile?.updated_at,
      profile?.created_at,
      qualification?.updated_at,
      qualification?.submitted_at,
      ...activity.map((event) => event.occurredAt),
    ]) || user.created_at;
    const step = currentStep(profile, Boolean(qualification));
    const idleMs = Math.max(0, nowMs - time(lastActivityAt));
    const health = step === "complete" ? "complete" : idleMs >= stalledAfterMs ? "stalled" : "in_progress";

    creators.push({
      userId: user.id,
      email: user.email,
      creatorProfileId: profile?.id ?? null,
      displayName: profile?.display_name ?? null,
      tiktokHandle: profile?.tiktok_handle ?? null,
      networkStatus: profile?.network_status ?? null,
      profileCompletionPercent: profile?.profile_completion_percent ?? 0,
      registeredAt: user.created_at,
      lastActivityAt,
      qualificationSubmittedAt: qualification?.submitted_at ?? null,
      currentStep: step,
      health,
      stalledForMinutes: health === "stalled" ? Math.floor(idleMs / 60_000) : null,
      activity,
    });
  }

  creators.sort((a, b) => time(b.registeredAt) - time(a.registeredAt));

  return {
    generatedAt: now,
    stalledAfterMinutes,
    summary: {
      totalCreators: creators.length,
      completed: creators.filter((creator) => creator.health === "complete").length,
      stalled: creators.filter((creator) => creator.health === "stalled").length,
      inProgress: creators.filter((creator) => creator.health === "in_progress").length,
      registrationsLast24h: creators.filter((creator) => time(creator.registeredAt) >= dayAgo).length,
    },
    creators,
  };
}
