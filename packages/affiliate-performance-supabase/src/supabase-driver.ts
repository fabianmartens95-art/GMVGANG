import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PerformanceChannel,
  PerformanceGrain,
  PerformanceProvider
} from "@gmvgang/affiliate-performance";
import {
  AFFILIATE_PERFORMANCE_TABLE,
  type AffiliatePerformancePersistenceDriver,
  type AffiliatePerformanceQuery,
  type PersistedAffiliatePerformanceMeasurement
} from "./types.js";

const SELECT_FIELDS = [
  "provider",
  "external_record_id",
  "connection_id",
  "grain",
  "channel",
  "organization_id",
  "brand_id",
  "campaign_id",
  "shop_id",
  "product_id",
  "creator_id",
  "content_id",
  "start_date",
  "end_date_exclusive",
  "time_zone",
  "currency",
  "status",
  "gmv",
  "orders",
  "units_sold",
  "commission",
  "refunds",
  "refunded_items",
  "impressions",
  "clicks",
  "add_to_cart",
  "views",
  "creator_posts",
  "record_fingerprint",
  "coverage_key",
  "first_observed_at",
  "last_observed_at"
].join(",");

const PROVIDERS = new Set<PerformanceProvider>([
  "tiktok-shop-seller-analytics",
  "csv-import",
  "notion",
  "manual"
]);
const GRAINS = new Set<PerformanceGrain>(["shop", "campaign", "creator", "product", "content"]);
const CHANNELS = new Set<PerformanceChannel>([
  "total",
  "affiliate-total",
  "affiliate-video",
  "affiliate-live",
  "seller-video",
  "seller-live",
  "seller-product-card",
  "shop-tab",
  "unknown"
]);

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new Error(`AFFILIATE_PERFORMANCE_ROW_INVALID:${key}`);
  return value;
}

function optionalString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`AFFILIATE_PERFORMANCE_ROW_INVALID:${key}`);
  return value;
}

function optionalNumber(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`AFFILIATE_PERFORMANCE_ROW_INVALID:${key}`);
  return parsed;
}

function rowToMeasurement(row: Record<string, unknown>): PersistedAffiliatePerformanceMeasurement {
  const provider = requiredString(row, "provider") as PerformanceProvider;
  const grain = requiredString(row, "grain") as PerformanceGrain;
  const channel = requiredString(row, "channel") as PerformanceChannel;
  const status = requiredString(row, "status");
  if (!PROVIDERS.has(provider)) throw new Error("AFFILIATE_PERFORMANCE_ROW_INVALID:provider");
  if (!GRAINS.has(grain)) throw new Error("AFFILIATE_PERFORMANCE_ROW_INVALID:grain");
  if (!CHANNELS.has(channel)) throw new Error("AFFILIATE_PERFORMANCE_ROW_INVALID:channel");
  if (status !== "provisional" && status !== "final") throw new Error("AFFILIATE_PERFORMANCE_ROW_INVALID:status");

  return {
    provider,
    externalRecordId: requiredString(row, "external_record_id"),
    ...(optionalString(row, "connection_id") ? { connectionId: optionalString(row, "connection_id")! } : {}),
    grain,
    channel,
    organizationId: requiredString(row, "organization_id"),
    ...(optionalString(row, "brand_id") ? { brandId: optionalString(row, "brand_id")! } : {}),
    ...(optionalString(row, "campaign_id") ? { campaignId: optionalString(row, "campaign_id")! } : {}),
    ...(optionalString(row, "shop_id") ? { shopId: optionalString(row, "shop_id")! } : {}),
    ...(optionalString(row, "product_id") ? { productId: optionalString(row, "product_id")! } : {}),
    ...(optionalString(row, "creator_id") ? { creatorId: optionalString(row, "creator_id")! } : {}),
    ...(optionalString(row, "content_id") ? { contentId: optionalString(row, "content_id")! } : {}),
    startDate: requiredString(row, "start_date"),
    endDateExclusive: requiredString(row, "end_date_exclusive"),
    timeZone: requiredString(row, "time_zone"),
    currency: requiredString(row, "currency"),
    status,
    ...(optionalNumber(row, "gmv") !== undefined ? { gmv: optionalNumber(row, "gmv")! } : {}),
    ...(optionalNumber(row, "orders") !== undefined ? { orders: optionalNumber(row, "orders")! } : {}),
    ...(optionalNumber(row, "units_sold") !== undefined ? { unitsSold: optionalNumber(row, "units_sold")! } : {}),
    ...(optionalNumber(row, "commission") !== undefined ? { commission: optionalNumber(row, "commission")! } : {}),
    ...(optionalNumber(row, "refunds") !== undefined ? { refunds: optionalNumber(row, "refunds")! } : {}),
    ...(optionalNumber(row, "refunded_items") !== undefined ? { refundedItems: optionalNumber(row, "refunded_items")! } : {}),
    ...(optionalNumber(row, "impressions") !== undefined ? { impressions: optionalNumber(row, "impressions")! } : {}),
    ...(optionalNumber(row, "clicks") !== undefined ? { clicks: optionalNumber(row, "clicks")! } : {}),
    ...(optionalNumber(row, "add_to_cart") !== undefined ? { addToCart: optionalNumber(row, "add_to_cart")! } : {}),
    ...(optionalNumber(row, "views") !== undefined ? { views: optionalNumber(row, "views")! } : {}),
    ...(optionalNumber(row, "creator_posts") !== undefined ? { creatorPosts: optionalNumber(row, "creator_posts")! } : {}),
    recordFingerprint: requiredString(row, "record_fingerprint"),
    coverageKey: requiredString(row, "coverage_key"),
    firstObservedAt: requiredString(row, "first_observed_at"),
    lastObservedAt: requiredString(row, "last_observed_at")
  };
}

function measurementToRow(measurement: PersistedAffiliatePerformanceMeasurement): Record<string, unknown> {
  return {
    provider: measurement.provider,
    external_record_id: measurement.externalRecordId,
    connection_id: measurement.connectionId ?? null,
    grain: measurement.grain,
    channel: measurement.channel,
    organization_id: measurement.organizationId,
    brand_id: measurement.brandId ?? null,
    campaign_id: measurement.campaignId ?? null,
    shop_id: measurement.shopId ?? null,
    product_id: measurement.productId ?? null,
    creator_id: measurement.creatorId ?? null,
    content_id: measurement.contentId ?? null,
    start_date: measurement.startDate,
    end_date_exclusive: measurement.endDateExclusive,
    time_zone: measurement.timeZone,
    currency: measurement.currency,
    status: measurement.status,
    gmv: measurement.gmv ?? null,
    orders: measurement.orders ?? null,
    units_sold: measurement.unitsSold ?? null,
    commission: measurement.commission ?? null,
    refunds: measurement.refunds ?? null,
    refunded_items: measurement.refundedItems ?? null,
    impressions: measurement.impressions ?? null,
    clicks: measurement.clicks ?? null,
    add_to_cart: measurement.addToCart ?? null,
    views: measurement.views ?? null,
    creator_posts: measurement.creatorPosts ?? null,
    record_fingerprint: measurement.recordFingerprint,
    coverage_key: measurement.coverageKey,
    first_observed_at: measurement.firstObservedAt,
    last_observed_at: measurement.lastObservedAt
  };
}

export function createSupabaseAffiliatePerformanceDriver(
  client: SupabaseClient
): AffiliatePerformancePersistenceDriver {
  return {
    async insert(measurement) {
      const { error } = await client.from(AFFILIATE_PERFORMANCE_TABLE).insert(measurementToRow(measurement));
      if (!error) return "inserted";
      if (error.code === "23505") return "unique_conflict";
      throw new Error(`AFFILIATE_PERFORMANCE_INSERT_FAILED:${error.code ?? "unknown"}`);
    },

    async findByIdentity(provider, externalRecordId) {
      const { data, error } = await client
        .from(AFFILIATE_PERFORMANCE_TABLE)
        .select(SELECT_FIELDS)
        .eq("provider", provider)
        .eq("external_record_id", externalRecordId)
        .maybeSingle();
      ensureNoError(error, "AFFILIATE_PERFORMANCE_IDENTITY_QUERY_FAILED");
      return data ? rowToMeasurement(data as unknown as Record<string, unknown>) : null;
    },

    async findByCoverage(coverageKey) {
      const { data, error } = await client
        .from(AFFILIATE_PERFORMANCE_TABLE)
        .select(SELECT_FIELDS)
        .eq("coverage_key", coverageKey)
        .maybeSingle();
      ensureNoError(error, "AFFILIATE_PERFORMANCE_COVERAGE_QUERY_FAILED");
      return data ? rowToMeasurement(data as unknown as Record<string, unknown>) : null;
    },

    async touchLastObservedAt(provider, externalRecordId, observedAt) {
      const { error } = await client
        .from(AFFILIATE_PERFORMANCE_TABLE)
        .update({ last_observed_at: observedAt })
        .eq("provider", provider)
        .eq("external_record_id", externalRecordId)
        .lt("last_observed_at", observedAt);
      ensureNoError(error, "AFFILIATE_PERFORMANCE_TOUCH_FAILED");
    },

    async list(input: AffiliatePerformanceQuery) {
      let query = client
        .from(AFFILIATE_PERFORMANCE_TABLE)
        .select(SELECT_FIELDS)
        .eq("organization_id", input.organizationId);

      if (input.brandId) query = query.eq("brand_id", input.brandId);
      if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
      if (input.grain) query = query.eq("grain", input.grain);
      if (input.channel) query = query.eq("channel", input.channel);
      if (input.startDateOnOrAfter) query = query.gte("start_date", input.startDateOnOrAfter);
      if (input.endDateExclusiveOnOrBefore) {
        query = query.lte("end_date_exclusive", input.endDateExclusiveOnOrBefore);
      }

      const { data, error } = await query
        .order("start_date", { ascending: false })
        .order("external_record_id", { ascending: true })
        .limit(input.limit ?? 200);
      ensureNoError(error, "AFFILIATE_PERFORMANCE_LIST_FAILED");
      return (data ?? []).map((row) => rowToMeasurement(row as unknown as Record<string, unknown>));
    }
  };
}
