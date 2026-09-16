import { completeCreatorProfile, registerCreator } from "@gmvgang/creator-registration";
import {
  createPlatformAdminClient,
  createSupabaseCreatorRegistrationPorts,
  ensureSupabaseCreatorMembership,
  resolveSupabasePlatformSessionContext,
  type PlatformSupabaseConfig,
} from "@gmvgang/platform-supabase";
import type { PlatformApiServices } from "./types.js";

export function createSupabasePlatformApiServices(config: PlatformSupabaseConfig): PlatformApiServices {
  const client = createPlatformAdminClient(config);
  const registrationPorts = createSupabaseCreatorRegistrationPorts(client);

  return {
    resolveSessionContext(input) {
      return resolveSupabasePlatformSessionContext(client, input);
    },
    async registerCreator(input, context) {
      const result = await registerCreator(input, context, registrationPorts);
      if (result.ok) {
        await ensureSupabaseCreatorMembership(client, context.userId, context.now);
      }
      return result;
    },
    completeCreatorProfile(input, context) {
      return completeCreatorProfile(input, context, registrationPorts);
    },
  };
}
