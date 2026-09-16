import {
  assertConnectionOwnership,
  canSyncConnection,
  type ExternalConnection
} from "@gmvgang/platform-foundation";
import { normalizePerformanceBatch } from "./normalize.js";
import type {
  AffiliatePerformanceMetrics,
  AffiliatePerformanceRecord,
  NormalizedPerformanceBatch,
  PerformanceChannel
} from "./types.js";

export const TIKTOK_SHOP_ANALYTICS_SCOPE = "data.shop_analytics.public.read";

export interface TikTokMoneyValue {
  amount: string;
  currency: string;
}

export interface TikTokProductPerformanceValues {
  gmv?: TikTokMoneyValue;
  orders?: number;
  items_sold?: number;
  product_impressions?: number;
  product_clicks?: number;
  add_cart_count?: number;
  refunds?: TikTokMoneyValue;
  refunded_items?: number;
}

export interface TikTokSellerProductPerformanceRow {
  id: string;
  total_performance?: TikTokProductPerformanceValues;
  affiliate_total_performance?: TikTokProductPerformanceValues;
}

export interface TikTokSellerProductPerformancePage {
  products: TikTokSellerProductPerformanceRow[];
  nextPageToken?: string;
  requestId?: string;
}

export interface TikTokSellerProductPageRequest {
  connectionId: string;
  shopId: string;
  startDate: string;
  endDateExclusive: string;
  shopTimeZone: string;
  currency: "LOCAL" | "USD";
  pageSize: 100;
  pageToken?: string;
}

/**
 * Infrastructure-owned boundary. A production implementation resolves seller OAuth,
 * shop_cipher and request signatures internally. Raw tokens must never cross this port.
 */
export interface TikTokSellerAnalyticsAuthorizedClient {
  getProductPerformancePage(
    request: TikTokSellerProductPageRequest
  ): Promise<TikTokSellerProductPerformancePage>;
}

export interface TikTokSellerProductSyncInput {
  connection: ExternalConnection;
  shopId: string;
  startDate: string;
  endDateExclusive: string;
  shopTimeZone: string;
  currency: "LOCAL" | "USD";
  observedAt: string;
  brandId?: string;
  maxPages?: number;
}

export type TikTokVideoAccountType =
  | "ALL"
  | "OFFICIAL_ACCOUNTS"
  | "MARKETING_ACCOUNTS"
  | "AFFILIATE_ACCOUNTS";

export type TikTokVideoAuthorType = "OFFICIAL" | "CHANNEL" | "AFFILIATE";

export interface TikTokVideoCreator {
  open_id: string;
  user_name?: string;
  nick_name?: string;
  author_type: string;
}

export interface TikTokSellerVideoPerformanceRow {
  id: string;
  title?: string;
  username?: string;
  creator?: TikTokVideoCreator;
  video_post_time?: string;
  duration?: number;
  hash_tags?: string[];
  gmv?: TikTokMoneyValue;
  gpm?: TikTokMoneyValue;
  avg_customers?: number;
  sku_orders?: number;
  items_sold?: number;
  views?: number;
  click_through_rate?: string;
}

export interface TikTokSellerVideoPerformancePage {
  videos: TikTokSellerVideoPerformanceRow[];
  nextPageToken?: string;
  requestId?: string;
}

export interface TikTokSellerVideoPageRequest {
  connectionId: string;
  shopId: string;
  startDate: string;
  endDateExclusive: string;
  shopTimeZone: string;
  currency: "LOCAL" | "USD";
  accountType: TikTokVideoAccountType;
  pageSize: 100;
  pageToken?: string;
}

/**
 * Infrastructure-owned boundary for v202605 Shop Video Performance reads.
 * OAuth access tokens, app secrets, shop_cipher and signatures remain behind this port.
 */
export interface TikTokSellerVideoAnalyticsAuthorizedClient {
  getVideoPerformancePage(
    request: TikTokSellerVideoPageRequest
  ): Promise<TikTokSellerVideoPerformancePage>;
}

export interface TikTokVideoAttributionLookup {
  organizationId: string;
  connectionId: string;
  shopId: string;
  videoId: string;
  creatorOpenId: string;
  authorType: TikTokVideoAuthorType;
}

export interface TikTokVideoAttributionResolution {
  creatorId: string;
  contentId: string;
  campaignId?: string;
  productId?: string;
}

/**
 * Protected identity boundary. Raw TikTok creator identifiers are resolved to stable
 * internal references here and must not be copied into canonical performance records.
 */
export interface TikTokVideoAttributionResolver {
  resolve(input: TikTokVideoAttributionLookup): Promise<TikTokVideoAttributionResolution | null>;
}

export interface TikTokSellerVideoSyncInput {
  connection: ExternalConnection;
  shopId: string;
  startDate: string;
  endDateExclusive: string;
  shopTimeZone: string;
  currency: "LOCAL" | "USD";
  accountType: TikTokVideoAccountType;
  observedAt: string;
  brandId?: string;
  maxPages?: number;
}

function requireFiniteNonNegative(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_TIKTOK_${field.toUpperCase()}`);
  return value;
}

function parseMoney(value: TikTokMoneyValue | undefined, field: string): { amount?: number; currency?: string } {
  if (!value) return {};
  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`INVALID_TIKTOK_${field.toUpperCase()}_AMOUNT`);
  const currency = value.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`INVALID_TIKTOK_${field.toUpperCase()}_CURRENCY`);
  return { amount, currency };
}

function metricsFromPerformance(values: TikTokProductPerformanceValues): {
  metrics: AffiliatePerformanceMetrics;
  currency: string;
} {
  const gmv = parseMoney(values.gmv, "gmv");
  const refunds = parseMoney(values.refunds, "refunds");
  const currency = gmv.currency ?? refunds.currency;
  if (!currency) throw new Error("TIKTOK_PRODUCT_PERFORMANCE_CURRENCY_MISSING");
  if (gmv.currency && refunds.currency && gmv.currency !== refunds.currency) {
    throw new Error("TIKTOK_PRODUCT_PERFORMANCE_CURRENCY_CONFLICT");
  }

  const metrics: AffiliatePerformanceMetrics = {};
  if (gmv.amount !== undefined) metrics.gmv = gmv.amount;
  const orders = requireFiniteNonNegative(values.orders, "orders");
  if (orders !== undefined) metrics.orders = orders;
  const unitsSold = requireFiniteNonNegative(values.items_sold, "items_sold");
  if (unitsSold !== undefined) metrics.unitsSold = unitsSold;
  const impressions = requireFiniteNonNegative(values.product_impressions, "product_impressions");
  if (impressions !== undefined) metrics.impressions = impressions;
  const clicks = requireFiniteNonNegative(values.product_clicks, "product_clicks");
  if (clicks !== undefined) metrics.clicks = clicks;
  const addToCart = requireFiniteNonNegative(values.add_cart_count, "add_cart_count");
  if (addToCart !== undefined) metrics.addToCart = addToCart;
  if (refunds.amount !== undefined) metrics.refunds = refunds.amount;
  const refundedItems = requireFiniteNonNegative(values.refunded_items, "refunded_items");
  if (refundedItems !== undefined) metrics.refundedItems = refundedItems;

  return { metrics, currency };
}

function productRecordId(input: TikTokSellerProductSyncInput, productId: string, channel: PerformanceChannel): string {
  return [
    "tiktok-seller-analytics",
    input.connection.id,
    input.shopId,
    "product",
    productId,
    channel,
    input.startDate,
    input.endDateExclusive
  ].join(":");
}

function toProductRecord(
  input: TikTokSellerProductSyncInput,
  productId: string,
  channel: "total" | "affiliate-total",
  values: TikTokProductPerformanceValues
): AffiliatePerformanceRecord {
  const { metrics, currency } = metricsFromPerformance(values);
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId: productRecordId(input, productId, channel),
      connectionId: input.connection.id
    },
    grain: "product",
    channel,
    dimensions: {
      organizationId: input.connection.ownerId,
      ...(input.brandId ? { brandId: input.brandId } : {}),
      shopId: input.shopId,
      productId
    },
    window: {
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
      timeZone: input.shopTimeZone
    },
    currency,
    status: "final",
    metrics,
    observedAt: input.observedAt
  };
}

const VIDEO_ACCOUNT_TYPES = new Set<TikTokVideoAccountType>([
  "ALL",
  "OFFICIAL_ACCOUNTS",
  "MARKETING_ACCOUNTS",
  "AFFILIATE_ACCOUNTS"
]);
const VIDEO_AUTHOR_TYPES = new Set<TikTokVideoAuthorType>(["OFFICIAL", "CHANNEL", "AFFILIATE"]);

function requireVideoAccountType(value: string): TikTokVideoAccountType {
  if (!VIDEO_ACCOUNT_TYPES.has(value as TikTokVideoAccountType)) throw new Error("TIKTOK_VIDEO_ACCOUNT_TYPE_INVALID");
  return value as TikTokVideoAccountType;
}

function requireVideoAuthorType(value: string | undefined): TikTokVideoAuthorType {
  const normalized = value?.trim().toUpperCase() as TikTokVideoAuthorType | undefined;
  if (!normalized || !VIDEO_AUTHOR_TYPES.has(normalized)) throw new Error("TIKTOK_VIDEO_AUTHOR_TYPE_INVALID");
  return normalized;
}

function accountTypeMatchesAuthor(accountType: TikTokVideoAccountType, authorType: TikTokVideoAuthorType): boolean {
  if (accountType === "ALL") return true;
  if (accountType === "AFFILIATE_ACCOUNTS") return authorType === "AFFILIATE";
  if (accountType === "OFFICIAL_ACCOUNTS") return authorType === "OFFICIAL";
  return authorType === "CHANNEL";
}

function channelForVideo(authorType: TikTokVideoAuthorType): "affiliate-video" | "seller-video" {
  return authorType === "AFFILIATE" ? "affiliate-video" : "seller-video";
}

function metricsFromVideo(row: TikTokSellerVideoPerformanceRow): {
  metrics: AffiliatePerformanceMetrics;
  currency: string;
} {
  const gmv = parseMoney(row.gmv, "video_gmv");
  const gpm = parseMoney(row.gpm, "video_gpm");
  const currency = gmv.currency ?? gpm.currency;
  if (!currency) throw new Error("TIKTOK_VIDEO_PERFORMANCE_CURRENCY_MISSING");
  if (gmv.currency && gpm.currency && gmv.currency !== gpm.currency) {
    throw new Error("TIKTOK_VIDEO_PERFORMANCE_CURRENCY_CONFLICT");
  }

  const metrics: AffiliatePerformanceMetrics = {};
  if (gmv.amount !== undefined) metrics.gmv = gmv.amount;
  const orders = requireFiniteNonNegative(row.sku_orders, "video_sku_orders");
  if (orders !== undefined) metrics.orders = orders;
  const unitsSold = requireFiniteNonNegative(row.items_sold, "video_items_sold");
  if (unitsSold !== undefined) metrics.unitsSold = unitsSold;
  const views = requireFiniteNonNegative(row.views, "video_views");
  if (views !== undefined) metrics.views = views;
  if (Object.keys(metrics).length === 0) throw new Error("TIKTOK_VIDEO_ADDITIVE_METRICS_MISSING");

  return { metrics, currency };
}

function videoRecordId(
  input: TikTokSellerVideoSyncInput,
  videoId: string,
  channel: "affiliate-video" | "seller-video"
): string {
  return [
    "tiktok-seller-analytics",
    input.connection.id,
    input.shopId,
    "content",
    videoId,
    channel,
    input.startDate,
    input.endDateExclusive
  ].join(":");
}

export function assertTikTokSellerAnalyticsConnection(
  connection: ExternalConnection,
  shopId: string,
  now: string
): void {
  assertConnectionOwnership(connection);
  if (connection.provider !== "tiktok_shop_seller") throw new Error("WRONG_TIKTOK_CONNECTION_PROVIDER");
  if (!canSyncConnection(connection, now)) throw new Error("TIKTOK_SELLER_CONNECTION_NOT_SYNCABLE");
  if (!connection.grantedScopes.includes(TIKTOK_SHOP_ANALYTICS_SCOPE)) {
    throw new Error("TIKTOK_SHOP_ANALYTICS_SCOPE_MISSING");
  }
  if (!(connection.externalShopIds ?? []).includes(shopId)) {
    throw new Error("TIKTOK_SHOP_NOT_AUTHORIZED_FOR_CONNECTION");
  }
}

export function mapTikTokProductPerformancePage(
  page: TikTokSellerProductPerformancePage,
  input: TikTokSellerProductSyncInput
): AffiliatePerformanceRecord[] {
  const records: AffiliatePerformanceRecord[] = [];

  for (const product of page.products) {
    const productId = product.id?.trim();
    if (!productId) throw new Error("TIKTOK_PRODUCT_ID_MISSING");
    if (product.total_performance) {
      records.push(toProductRecord(input, productId, "total", product.total_performance));
    }
    if (product.affiliate_total_performance) {
      records.push(toProductRecord(input, productId, "affiliate-total", product.affiliate_total_performance));
    }
  }

  return records;
}

export async function mapTikTokVideoPerformancePage(
  page: TikTokSellerVideoPerformancePage,
  input: TikTokSellerVideoSyncInput,
  attribution: TikTokVideoAttributionResolver
): Promise<AffiliatePerformanceRecord[]> {
  const accountType = requireVideoAccountType(input.accountType);
  const records: AffiliatePerformanceRecord[] = [];

  for (const video of page.videos) {
    const videoId = video.id?.trim();
    if (!videoId) throw new Error("TIKTOK_VIDEO_ID_MISSING");
    const creatorOpenId = video.creator?.open_id?.trim();
    if (!creatorOpenId) throw new Error("TIKTOK_VIDEO_CREATOR_OPEN_ID_MISSING");
    const authorType = requireVideoAuthorType(video.creator?.author_type);
    if (!accountTypeMatchesAuthor(accountType, authorType)) {
      throw new Error("TIKTOK_VIDEO_ACCOUNT_TYPE_MISMATCH");
    }

    const resolved = await attribution.resolve({
      organizationId: input.connection.ownerId,
      connectionId: input.connection.id,
      shopId: input.shopId,
      videoId,
      creatorOpenId,
      authorType
    });
    if (!resolved) throw new Error("TIKTOK_VIDEO_ATTRIBUTION_UNRESOLVED");
    const creatorId = resolved.creatorId?.trim();
    if (!creatorId) throw new Error("TIKTOK_VIDEO_INTERNAL_CREATOR_ID_MISSING");
    const contentId = resolved.contentId?.trim();
    if (!contentId) throw new Error("TIKTOK_VIDEO_INTERNAL_CONTENT_ID_MISSING");

    const channel = channelForVideo(authorType);
    const { metrics, currency } = metricsFromVideo(video);
    records.push({
      source: {
        provider: "tiktok-shop-seller-analytics",
        externalRecordId: videoRecordId(input, videoId, channel),
        connectionId: input.connection.id
      },
      grain: "content",
      channel,
      dimensions: {
        organizationId: input.connection.ownerId,
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(resolved.campaignId?.trim() ? { campaignId: resolved.campaignId.trim() } : {}),
        shopId: input.shopId,
        ...(resolved.productId?.trim() ? { productId: resolved.productId.trim() } : {}),
        creatorId,
        contentId
      },
      window: {
        startDate: input.startDate,
        endDateExclusive: input.endDateExclusive,
        timeZone: input.shopTimeZone
      },
      currency,
      status: "final",
      metrics,
      observedAt: input.observedAt
    });
  }

  return records;
}

export async function syncTikTokSellerProductPerformance(
  client: TikTokSellerAnalyticsAuthorizedClient,
  input: TikTokSellerProductSyncInput
): Promise<NormalizedPerformanceBatch> {
  assertTikTokSellerAnalyticsConnection(input.connection, input.shopId, input.observedAt);
  const maxPages = input.maxPages ?? 1000;
  if (!Number.isInteger(maxPages) || maxPages <= 0) throw new Error("INVALID_TIKTOK_MAX_PAGES");

  const seenTokens = new Set<string>();
  const records: AffiliatePerformanceRecord[] = [];
  let pageToken: string | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const request: TikTokSellerProductPageRequest = {
      connectionId: input.connection.id,
      shopId: input.shopId,
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
      shopTimeZone: input.shopTimeZone,
      currency: input.currency,
      pageSize: 100,
      ...(pageToken ? { pageToken } : {})
    };

    const page = await client.getProductPerformancePage(request);
    records.push(...mapTikTokProductPerformancePage(page, input));

    const next = page.nextPageToken?.trim();
    if (!next) return normalizePerformanceBatch(records);
    if (seenTokens.has(next)) throw new Error("TIKTOK_PAGINATION_TOKEN_LOOP");
    seenTokens.add(next);
    pageToken = next;
  }

  throw new Error("TIKTOK_PAGINATION_PAGE_LIMIT_EXCEEDED");
}

export async function syncTikTokSellerVideoPerformance(
  client: TikTokSellerVideoAnalyticsAuthorizedClient,
  attribution: TikTokVideoAttributionResolver,
  input: TikTokSellerVideoSyncInput
): Promise<NormalizedPerformanceBatch> {
  assertTikTokSellerAnalyticsConnection(input.connection, input.shopId, input.observedAt);
  const accountType = requireVideoAccountType(input.accountType);
  const maxPages = input.maxPages ?? 1000;
  if (!Number.isInteger(maxPages) || maxPages <= 0) throw new Error("INVALID_TIKTOK_MAX_PAGES");

  const seenTokens = new Set<string>();
  const records: AffiliatePerformanceRecord[] = [];
  let pageToken: string | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const request: TikTokSellerVideoPageRequest = {
      connectionId: input.connection.id,
      shopId: input.shopId,
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
      shopTimeZone: input.shopTimeZone,
      currency: input.currency,
      accountType,
      pageSize: 100,
      ...(pageToken ? { pageToken } : {})
    };

    const page = await client.getVideoPerformancePage(request);
    records.push(...await mapTikTokVideoPerformancePage(page, input, attribution));

    const next = page.nextPageToken?.trim();
    if (!next) return normalizePerformanceBatch(records);
    if (seenTokens.has(next)) throw new Error("TIKTOK_PAGINATION_TOKEN_LOOP");
    seenTokens.add(next);
    pageToken = next;
  }

  throw new Error("TIKTOK_PAGINATION_PAGE_LIMIT_EXCEEDED");
}
