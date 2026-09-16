import { resolve } from "node:path";

export type PlatformServerConfig = {
  port: number;
  publicOrigin: string;
  portalDistDir: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  privacyNoticeVersion: string;
  production: boolean;
};

function required(value: string | undefined, code: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function validOrigin(value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('PLATFORM_PUBLIC_ORIGIN_INVALID');
  }
  return parsed.origin;
}

function port(value: string | undefined): number {
  const parsed = Number(value ?? '3000');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error('PORT_INVALID');
  return parsed;
}

export function loadPlatformServerConfig(env: NodeJS.ProcessEnv = process.env): PlatformServerConfig {
  const production = env.NODE_ENV === 'production';
  const publicOrigin = validOrigin(required(env.PLATFORM_PUBLIC_ORIGIN, 'PLATFORM_PUBLIC_ORIGIN_REQUIRED'));

  return {
    port: port(env.PORT),
    publicOrigin,
    portalDistDir: resolve(env.PLATFORM_PORTAL_DIST_DIR?.trim() || 'apps/platform-portal/dist'),
    supabaseUrl: required(env.SUPABASE_URL, 'SUPABASE_URL_REQUIRED'),
    supabasePublishableKey: required(env.SUPABASE_PUBLISHABLE_KEY, 'SUPABASE_PUBLISHABLE_KEY_REQUIRED'),
    supabaseServiceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY_REQUIRED'),
    privacyNoticeVersion: required(env.CREATOR_PRIVACY_NOTICE_VERSION, 'CREATOR_PRIVACY_NOTICE_VERSION_REQUIRED'),
    production,
  };
}
