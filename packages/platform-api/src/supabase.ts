import { createAffiliatePerformanceStore, createSupabaseAffiliatePerformanceDriver } from "@gmvgang/affiliate-performance-supabase";
import { completeCreatorProfile, registerCreator } from "@gmvgang/creator-registration";
import { unavailableBrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import {
  createPlatformAdminClient,
  createSupabaseCreatorReferralReadPort,
  createSupabaseCreatorRegistrationPorts,
  ensureSupabaseCreatorMembership,
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
      try {
        const source = await options.creatorWorkspace.readForCreator({ creatorMasterId, now: input.now });
        return buildCreatorWorkspaceReadModel(source, input.now);
      } catch (error) {
        const code = error instanceof Error ? (error.message.split(":", 1)[0] ?? "") : "";
        if (code.startsWith("COMPANY_OS_CREATOR_WORKSPACE_")) {
          console.warn("GMVGANG_CREATOR_WORKSPACE_SOURCE_UNAVAILABLE", { code });
          return unavailableCreatorWorkspaceReadModel(input.now, "source_not_configured");
        }
        throw error;
      }
    },
    async registerCreator(input, context) {
      const result = await registerCreator(input, context, registrationPorts);
      if (!result.ok) return result;

      await ensureSupabaseCreatorMembership(client, context.userId, context.now);
      const creatorProfile = await syncCreatorOperations(result.creatorProfile, context.now);
      return { ...result, creatorProfile };
    },
    async completeCreatorProfile(input, context) {
      const profile = await completeCreatorProfile(input, context, registrationPorts);
      return syncCreatorOperations(profile, context.now);
    },
  };
}
