export const TIKTOK_SELLER_ANALYTICS_ENDPOINTS = {
  productPerformance: "/analytics/202605/shop_products/performance",
  videoPerformance: "/analytics/202605/shop_videos/performance"
} as const;

export const TIKTOK_SELLER_ANALYTICS_CONTRACT = {
  apiVersion: "202605",
  authorization: "seller-oauth",
  scopeFamily: "TikTok Shop Analytics",
  availability: "all-markets",
  dataLatency: "T-1",
  maxPageSize: 100
} as const;

export interface TikTokSellerAnalyticsQuery {
  connectionId: string;
  shopId: string;
  shopTimeZone: string;
  startDate: string;
  endDateExclusive: string;
  currency: "LOCAL" | "USD";
}

export interface TikTokSellerAnalyticsRequestPlan {
  connectionId: string;
  shopId: string;
  shopTimeZone: string;
  startDate: string;
  endDateExclusive: string;
  currency: "LOCAL" | "USD";
  pageSize: 100;
  endpoints: typeof TIKTOK_SELLER_ANALYTICS_ENDPOINTS;
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

export function buildTikTokSellerAnalyticsRequestPlan(
  query: TikTokSellerAnalyticsQuery
): TikTokSellerAnalyticsRequestPlan {
  if (query.startDate >= query.endDateExclusive) {
    throw new Error("TikTok Seller Analytics query must end after it starts");
  }

  return {
    connectionId: requireText(query.connectionId, "connectionId"),
    shopId: requireText(query.shopId, "shopId"),
    shopTimeZone: requireText(query.shopTimeZone, "shopTimeZone"),
    startDate: query.startDate,
    endDateExclusive: query.endDateExclusive,
    currency: query.currency,
    pageSize: 100,
    endpoints: TIKTOK_SELLER_ANALYTICS_ENDPOINTS
  };
}
