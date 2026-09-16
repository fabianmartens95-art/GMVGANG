import { createAffiliatePerformanceStore, createSupabaseAffiliatePerformanceDriver } from "@gmvgang/affiliate-performance-supabase";
import { completeCreatorProfile, registerCreator } from "@gmvgang/creator-registration";
import { unavailableBrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import {
  createPlatformAdminClient,
  createSupabaseCreatorRegistrationPorts,
  ensureSupabaseCreatorMembership,
  resolveSupabasePlatformSessionContext,
  type PlatformSupabaseConfig,
} from "@gmvgang/platform-supabase";
import {
  createAffiliatePerformanceBrandOverviewReadPort,
  type BrandAffiliatePerformancePolicy,
} from "./brand-performance.js";
import type { BrandOverviewReadPort, CreatorOperationsSyncPort, PlatformApiServices } from "./types.js";

export type SupabasePlatformApiOptions = {
  creatorOperationsSync?: CreatorOperationsSyncPort;
  brandOverview?: BrandOverviewReadPort;
  affiliatePerformancePolicy?: BrandAffiliatePerformancePolicy;
};

export function createSupabasePlatformApiServices(
  config: PlatformSupabaseConfig,
  options: SupabasePlatformApiOptions = {},
): PlatformApiServices {
  const client = createPlatformAdminClient(config);
  const registrationPorts = createSupabaseCreatorRegistrationPorts(client);
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
