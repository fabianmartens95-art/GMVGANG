import { resolve } from "node:path";
import { PERFORMANCE_METRIC_FIELDS, type PerformanceMetricField } from "@gmvgang/affiliate-performance";
import type { BrandAffiliatePerformancePolicy } from "@gmvgang/platform-api";

export type PlatformServerConfig = {
  port: number;
  publicOrigin: string;
  portalDistDir: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  privacyNoticeVersion: string;
  deploymentRevision: string;
  notionCreatorSync: {
    token: string;
    dataSourceId: string;
  } | null;
  notionCreatorWorkspace: {
    token: string;
    assignmentDataSourceId: string;
  } | null;
  affiliatePerformanceRead: BrandAffiliatePerformancePolicy | null;
  production: boolean;
};

const AFFILIATE_POLICY_ENV = [
  "AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED",
  "AFFILIATE_PERFORMANCE_LOOKBACK_DAYS",
  "AFFILIATE_PERFORMANCE_MAX_RECORDS",
  "AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO",
  "AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES",
  "AFFILIATE_PERFORMANCE_REQUIRED_METRICS",
] as const;

function required(value: string | undefined, code: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function validOrigin(value: string): string {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("PLATFORM_PUBLIC_ORIGIN_INVALID");
  }
  return parsed.origin;
}

function port(value: string | undefined): number {
  const parsed = Number(value ?? "3000");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error("PORT_INVALID");
  return parsed;
}

function deploymentRevision(env: NodeJS.ProcessEnv): string {
  return [env.APP_REVISION, env.RAILWAY_GIT_COMMIT_SHA, env.GITHUB_SHA]
    .map((value) => value?.trim() ?? "")
    .find(Boolean) || "unknown";
}

function notionCreatorSync(env: NodeJS.ProcessEnv): PlatformServerConfig["notionCreatorSync"] {
  const dataSourceId = env.NOTION_CREATOR_DATA_SOURCE_ID?.trim() ?? "";
  if (!dataSourceId) return null;
  const token = env.NOTION_TOKEN?.trim() ?? "";
  if (!token) throw new Error("NOTION_CREATOR_SYNC_CONFIG_INCOMPLETE");
  return { token, dataSourceId };
}

function notionCreatorWorkspace(env: NodeJS.ProcessEnv): PlatformServerConfig["notionCreatorWorkspace"] {
  const assignmentDataSourceId = env.NOTION_ASSIGNMENT_DATA_SOURCE_ID?.trim() ?? "";
  if (!assignmentDataSourceId) return null;
  const token = env.NOTION_TOKEN?.trim() ?? "";
  if (!token) throw new Error("NOTION_CREATOR_WORKSPACE_CONFIG_INCOMPLETE");
  return { token, assignmentDataSourceId };
}

function explicitFeatureFlag(value: string | undefined): boolean {
  const cleaned = value?.trim() ?? "";
  if (!cleaned || cleaned === "0") return false;
  if (cleaned === "1") return true;
  throw new Error("AFFILIATE_PERFORMANCE_READ_ENABLED_INVALID");
}

function finiteNumber(value: string | undefined, code: string): number {
  const parsed = Number(required(value, code));
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function positiveInteger(value: string | undefined, code: string, maximum?: number): number {
  const parsed = finiteNumber(value, code);
  if (!Number.isInteger(parsed) || parsed <= 0 || (maximum !== undefined && parsed > maximum)) throw new Error(code);
  return parsed;
}

function positiveNumber(value: string | undefined, code: string): number {
  const parsed = finiteNumber(value, code);
  if (parsed <= 0) throw new Error(code);
  return parsed;
}

function coverageRatio(value: string | undefined): number {
  const parsed = finiteNumber(value, "AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO_INVALID");
  if (parsed <= 0 || parsed > 1) throw new Error("AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO_INVALID");
  return parsed;
}

function requiredMetrics(value: string | undefined): PerformanceMetricField[] {
  const raw = required(value, "AFFILIATE_PERFORMANCE_REQUIRED_METRICS_REQUIRED");
  const values = [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
  if (values.length === 0) throw new Error("AFFILIATE_PERFORMANCE_REQUIRED_METRICS_REQUIRED");

  for (const metric of values) {
    if (!PERFORMANCE_METRIC_FIELDS.includes(metric as PerformanceMetricField)) {
      throw new Error("AFFILIATE_PERFORMANCE_REQUIRED_METRICS_INVALID");
    }
  }
  return values as PerformanceMetricField[];
}

function affiliatePerformanceRead(env: NodeJS.ProcessEnv): PlatformServerConfig["affiliatePerformanceRead"] {
  const enabled = explicitFeatureFlag(env.AFFILIATE_PERFORMANCE_READ_ENABLED);
  const hasPolicyValues = AFFILIATE_POLICY_ENV.some((key) => Boolean(env[key]?.trim()));

  if (!enabled) {
    if (hasPolicyValues) throw new Error("AFFILIATE_PERFORMANCE_READ_DISABLED_WITH_CONFIG");
    return null;
  }

  if (env.AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED?.trim() !== "1") {
    throw new Error("AFFILIATE_PERFORMANCE_SCHEMA_NOT_VERIFIED");
  }

  return {
    lookbackDays: positiveInteger(
      env.AFFILIATE_PERFORMANCE_LOOKBACK_DAYS,
      "AFFILIATE_PERFORMANCE_LOOKBACK_DAYS_INVALID",
      3650,
    ),
    maxRecords: positiveInteger(
      env.AFFILIATE_PERFORMANCE_MAX_RECORDS,
      "AFFILIATE_PERFORMANCE_MAX_RECORDS_INVALID",
      1000,
    ),
    minimumCoverageRatio: coverageRatio(env.AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO),
    maxSourceAgeMinutes: positiveNumber(
      env.AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES,
      "AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES_INVALID",
    ),
    requiredMetrics: requiredMetrics(env.AFFILIATE_PERFORMANCE_REQUIRED_METRICS),
  };
}

export function loadPlatformServerConfig(env: NodeJS.ProcessEnv = process.env): PlatformServerConfig {
  const production = env.NODE_ENV === "production";
  const publicOrigin = validOrigin(required(env.PLATFORM_PUBLIC_ORIGIN, "PLATFORM_PUBLIC_ORIGIN_REQUIRED"));

  return {
    port: port(env.PORT),
    publicOrigin,
    portalDistDir: resolve(env.PLATFORM_PORTAL_DIST_DIR?.trim() || "apps/platform-portal/dist"),
    supabaseUrl: required(env.SUPABASE_URL, "SUPABASE_URL_REQUIRED"),
    supabasePublishableKey: required(env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY_REQUIRED"),
    supabaseServiceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY_REQUIRED"),
    privacyNoticeVersion: required(env.CREATOR_PRIVACY_NOTICE_VERSION, "CREATOR_PRIVACY_NOTICE_VERSION_REQUIRED"),
    deploymentRevision: deploymentRevision(env),
    notionCreatorSync: notionCreatorSync(env),
    notionCreatorWorkspace: notionCreatorWorkspace(env),
    affiliatePerformanceRead: affiliatePerformanceRead(env),
    production,
  };
}
