import { registerCreator } from "@gmvgang/creator-registration";
import {
  createPlatformAdminClient,
  createSupabaseCreatorRegistrationPorts,
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
    registerCreator(input, context) {
      return registerCreator(input, context, registrationPorts);
    },
  };
}
