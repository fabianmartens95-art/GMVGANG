import { registerCreator } from "@gmvgang/creator-registration";
import {
  createPlatformAdminClient,
  createSupabaseCreatorRegistrationPorts,
  ensureCreatorPortalMembership,
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
      if (result.ok) await ensureCreatorPortalMembership(client, context.userId);
      return result;
    },
  };
}
