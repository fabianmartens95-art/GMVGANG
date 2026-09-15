export const PERFORMANCE_METRIC_FIELDS = [
  "gmv",
  "orders",
  "unitsSold",
  "commission",
  "refunds",
  "refundedItems",
  "impressions",
  "clicks",
  "addToCart",
  "views",
  "creatorPosts"
] as const;

export type PerformanceMetricField = (typeof PERFORMANCE_METRIC_FIELDS)[number];
export type AffiliatePerformanceMetrics = Partial<Record<PerformanceMetricField, number>>;

export type PerformanceProvider =
  | "tiktok-shop-seller-analytics"
  | "csv-import"
  | "notion"
  | "manual";

export type PerformanceGrain = "shop" | "campaign" | "creator" | "product" | "content";

export type PerformanceChannel =
  | "total"
  | "affiliate-total"
  | "affiliate-video"
  | "affiliate-live"
  | "seller-video"
  | "seller-live"
  | "seller-product-card"
  | "shop-tab"
  | "unknown";

export interface PerformanceDimensions {
  organizationId?: string;
  brandId?: string;
  campaignId?: string;
  shopId?: string;
  productId?: string;
  creatorId?: string;
  contentId?: string;
}

export interface PerformanceWindow {
  startDate: string;
  endDateExclusive: string;
  timeZone: string;
}

export interface PerformanceSource {
  provider: PerformanceProvider;
  externalRecordId: string;
  connectionId?: string;
}

export interface AffiliatePerformanceRecord {
  source: PerformanceSource;
  grain: PerformanceGrain;
  channel: PerformanceChannel;
  dimensions: PerformanceDimensions;
  window: PerformanceWindow;
  currency: string;
  status: "provisional" | "final";
  metrics: AffiliatePerformanceMetrics;
  observedAt: string;
}

export interface NormalizedPerformanceBatch {
  records: AffiliatePerformanceRecord[];
  duplicateRecordsDropped: number;
}

export interface AggregatedPerformance {
  provider: PerformanceProvider;
  grain: PerformanceGrain;
  channel: PerformanceChannel;
  window: PerformanceWindow;
  currency: string;
  recordCount: number;
  metrics: Record<PerformanceMetricField, number | null>;
  completeness: Record<PerformanceMetricField, number>;
}

export interface DerivedPerformanceRatios {
  ctr: number | null;
  clickOrderRate: number | null;
  aov: number | null;
  refundRate: number | null;
  gmvPerThousandViews: number | null;
}
