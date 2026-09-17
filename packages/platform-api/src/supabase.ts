import { createAffiliatePerformanceStore, createSupabaseAffiliatePerformanceDriver } from "@gmvgang/affiliate-performance-supabase";
import {
  completeCreatorProfile,
  registerCreator,
  type CreatorProfileCompletionCommand,
} from "@gmvgang/creator-registration";
import { unavailableBrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import {
  createPlatformAdminClient,
  createSupabaseCreatorQualificationStore,
  createSupabaseCreatorReferralReadPort,
  createSupabaseCreatorRegistrationPorts,
  ensureSupabaseCreatorMembership,
  manageSupabaseMembership,
  resolveSupabasePlatformSessionContext,
  type PlatformSupabaseConfig,
} from "@gmvgang/platform-supabase";
import {
  createAffiliatePerformanceBrandOverviewReadPort,
  type BrandAffiliatePerformancePolicy,
} from "./brand-performance.js";
import { buildCreatorReferralHubReadModel } from "./creator-referrals.js";
import {
  buildCreatorWorkspaceReadModel,
  unavailableCreatorWorkspaceReadModel,
} from "./creator-workspace.js";
import { buildTeamCreatorFunnelReadModel } from "./team-creator-funnel.js";
import type {
  BrandOverviewReadPort,
  CreatorOperationsSyncPort,
  CreatorWorkspaceSourcePort,
  PlatformApiServices,
} from "./types.js";

export type SupabasePlatformApiOptions = {
  creatorOperationsSync?: CreatorOperationsSyncPort;
  creatorWorkspace?: CreatorWorkspaceSourcePort;
  brandOverview?: BrandOverviewReadPort;
  affiliatePerformancePolicy?: BrandAffiliatePerformancePolicy;
};

export function governCreatorSelfServiceProfileInput(
  current: CreatorProfile,
  input: CreatorProfileCompletionCommand,
): CreatorProfileCompletionCommand {
  if (current.networkStatus === "registered") return input;

  const market = current.market?.trim();
  const language = current.language?.trim();
  const niche = current.niche?.map((item) => item.trim()).filter(Boolean);
  if (!market || !language || !niche?.length) {
    throw new Error("CREATOR_PROFILE_GOVERNANCE_STATE_INVALID");
  }

  return {
    tiktokHandle: current.tiktokHandle,
    displayName: input.displayName,
    market,
    language,
    niche,
  };
}

export function createSupabasePlatformApiServices(
  config: PlatformSupabaseConfig,
  options: SupabasePlatformApiOptions = {},
): PlatformApiServices {
  const client = createPlatformAdminClient(config);
  const registrationPorts = createSupabaseCreatorRegistrationPorts(client);
  const qualificationStore = createSupabaseCreatorQualificationStore(client);
  const referralReadPort = createSupabaseCreatorReferralReadPort(client);
  const brandOverview = options.brandOverview ?? (
    options.affiliatePerformancePolicy
      ? createAffiliatePerformanceBrandOverviewReadPort(
          createAffiliatePerformanceStore(createSupabaseAffiliatePerformanceDriver(client)),
          options.affiliatePerformancePolicy,
        )
      : undefined
  );

  async function syncCreatorOperations(profile: CreatorProfile, now: string): Promise<CreatorProfile> {
    if (!options.creatorOperationsSync) return profile;

    try {
      const result = await options.creatorOperationsSync.syncCreatorProfile(profile);
      const creatorMasterId = result.creatorMasterId?.trim();
      if (!creatorMasterId || creatorMasterId === profile.creatorMasterId) return profile;

      const linked: CreatorProfile = {
        ...profile,
        creatorMasterId,
        updatedAt: now,
      };
      await registrationPorts.profiles.updateProfile(linked);
      return linked;
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "CREATOR_OPERATIONS_SYNC_FAILED";
      console.error("GMVGANG_CREATOR_OPERATIONS_SYNC_FAILED", {
        creatorProfileId: profile.id,
        code,
      });
      return profile;
    }
  }

  return {
    resolveSessionContext(input) {
      return resolveSupabasePlatformSessionContext(client, input);
    },
    async recordAnalyticsEvent(input) {
      const { error } = await client.from("portal_analytics_events").insert({
        user_id: input.userId,
        organization_id: input.organizationId ?? null,
        event_name: input.eventName,
        path: input.path,
        client_session_id: input.clientSessionId,
        request_id: input.requestId ?? null,
        properties: input.properties,
        occurred_at: input.occurredAt,
      });
      if (error) throw new Error(`ANALYTICS_INSERT_FAILED:${error.code ?? "unknown"}`);
    },
    async getTeamCreatorFunnel(input) {
      const [users, profiles, qualifications, memberships, analytics, audit] = await Promise.all([
        client.from("platform_users")
          .select("id,email,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(500),
        client.from("creator_profiles")
          .select("id,user_id,tiktok_handle,display_name,network_status,profile_completion_percent,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(500),
        client.from("creator_qualifications")
          .select("creator_profile_id,submitted_at,updated_at")
          .order("updated_at", { ascending: false })
          .limit(500),
        client.from("memberships")
          .select("user_id,role,status")
          .limit(1000),
        client.from("portal_analytics_events")
          .select("user_id,event_name,path,occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(2000),
        client.from("platform_audit_events")
          .select("user_id,event,occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(2000),
      ]);

      const resultSets = [users, profiles, qualifications, memberships, analytics, audit];
      const failed = resultSets.find((result) => result.error);
      if (failed?.error) {
        throw new Error(`TEAM_CREATOR_FUNNEL_QUERY_FAILED:${failed.error.code ?? "unknown"}`);
      }

      return buildTeamCreatorFunnelReadModel({
        users: users.data ?? [],
        profiles: profiles.data ?? [],
        qualifications: qualifications.data ?? [],
        memberships: memberships.data ?? [],
        analytics: analytics.data ?? [],
        audit: audit.data ?? [],
      }, input.now);
    },
    manageMembership(input) {
      return manageSupabaseMembership(client, input);
    },
    async getBrandOverview(input) {
      if (brandOverview) return brandOverview.getOverview(input);
      return unavailableBrandPortalReadModel(input.organizationId, input.now);
    },
    async getCreatorProfile(input) {
      return registrationPorts.profiles.findByUserId(input.userId);
    },
    async getCreatorQualification(input) {
      const profile = await registrationPorts.profiles.findByUserId(input.userId);
      if (!profile) return null;
      return qualificationStore.findByCreatorProfileId(profile.id);
    },
    async submitCreatorQualification(input, context) {
      const profile = await registrationPorts.profiles.findByUserId(context.userId);
      if (!profile) throw new Error("CREATOR_PROFILE_NOT_FOUND");
      if (profile.networkStatus !== "profile_complete") {
        throw new Error("CREATOR_QUALIFICATION_LOCKED");
      }

      const existing = await qualificationStore.findByCreatorProfileId(profile.id);
      const qualification = await qualificationStore.save({
        creatorProfileId: profile.id,
        qualification: input,
        now: context.now,
      });
      const { error } = await client.from("platform_audit_events").insert({
        event: existing ? "creator.qualification.updated" : "creator.qualification.submitted",
        user_id: context.userId,
        creator_profile_id: profile.id,
        occurred_at: context.now,
        metadata: {
          schemaVersion: qualification.schemaVersion,
          networkStatus: profile.networkStatus,
        },
      });
      if (error) throw new Error(`AUDIT_INSERT_FAILED:${error.code ?? "unknown"}`);
      return qualification;
    },
    async getCreatorReferralHub(input) {
      const profile = await registrationPorts.profiles.findByUserId(input.userId);
      if (!profile) return null;
      const attributions = await referralReadPort.listByReferrerCreatorProfileId(profile.id);
      return buildCreatorReferralHubReadModel(profile, attributions);
    },
    async getCreatorWorkspace(input) {
      const profile = await registrationPorts.profiles.findByUserId(input.userId);
      if (!profile) return null;
      const creatorMasterId = profile.creatorMasterId?.trim();
      if (!creatorMasterId) {
        return unavailableCreatorWorkspaceReadModel(input.now, "creator_master_id_missing");
      }
      if (!options.creatorWorkspace) {
        return unavailableCreatorWorkspaceReadModel(input.now, "source_not_configured");
      }
      const source = await options.creatorWorkspace.readForCreator({ creatorMasterId, now: input.now });
      return buildCreatorWorkspaceReadModel(source, input.now);
    },
    async registerCreator(input, context) {
      const result = await registerCreator(input, context, registrationPorts);
      if (!result.ok) return result;

      await ensureSupabaseCreatorMembership(client, context.userId, context.now);
      const creatorProfile = await syncCreatorOperations(result.creatorProfile, context.now);
      return { ...result, creatorProfile };
    },
    async completeCreatorProfile(input, context) {
      const current = await registrationPorts.profiles.findByUserId(context.userId);
      const governedInput = current ? governCreatorSelfServiceProfileInput(current, input) : input;
      const profile = await completeCreatorProfile(governedInput, context, registrationPorts);
      return syncCreatorOperations(profile, context.now);
    },
  };
}
