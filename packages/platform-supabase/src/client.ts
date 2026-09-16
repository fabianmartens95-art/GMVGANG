import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PlatformSupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function required(value: string, code: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

export function createPlatformAdminClient(config: PlatformSupabaseConfig): SupabaseClient {
  const url = required(config.url, "SUPABASE_URL_REQUIRED");
  const serviceRoleKey = required(config.serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY_REQUIRED");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
