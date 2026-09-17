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
