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

function recordId(input: TikTokSellerProductSyncInput, productId: string, channel: PerformanceChannel): string {
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

function toRecord(
  input: TikTokSellerProductSyncInput,
  productId: string,
  channel: "total" | "affiliate-total",
  values: TikTokProductPerformanceValues
): AffiliatePerformanceRecord {
  const { metrics, currency } = metricsFromPerformance(values);
  return {
    source: {
      provider: "tiktok-shop-seller-analytics",
      externalRecordId: recordId(input, productId, channel),
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
      records.push(toRecord(input, productId, "total", product.total_performance));
    }
    if (product.affiliate_total_performance) {
      records.push(toRecord(input, productId, "affiliate-total", product.affiliate_total_performance));
    }
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
