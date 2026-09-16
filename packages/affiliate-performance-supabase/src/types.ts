import type {
  AffiliatePerformanceRecord,
  PerformanceChannel,
  PerformanceGrain,
  PerformanceProvider
} from "@gmvgang/affiliate-performance";

export const AFFILIATE_PERFORMANCE_TABLE = "affiliate_performance_measurements";

export interface PersistedAffiliatePerformanceMeasurement {
  provider: PerformanceProvider;
  externalRecordId: string;
  connectionId?: string;
  grain: PerformanceGrain;
  channel: PerformanceChannel;
  organizationId: string;
  brandId?: string;
  campaignId?: string;
  shopId?: string;
  productId?: string;
  creatorId?: string;
  contentId?: string;
  startDate: string;
  endDateExclusive: string;
  timeZone: string;
  currency: string;
  status: "provisional" | "final";
  gmv?: number;
  orders?: number;
  unitsSold?: number;
  commission?: number;
  refunds?: number;
  refundedItems?: number;
  impressions?: number;
  clicks?: number;
  addToCart?: number;
  views?: number;
  creatorPosts?: number;
  recordFingerprint: string;
  coverageKey: string;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface AffiliatePerformancePersistenceDriver {
  insert(measurement: PersistedAffiliatePerformanceMeasurement): Promise<"inserted" | "unique_conflict">;
  findByIdentity(provider: PerformanceProvider, externalRecordId: string): Promise<PersistedAffiliatePerformanceMeasurement | null>;
  findByCoverage(coverageKey: string): Promise<PersistedAffiliatePerformanceMeasurement | null>;
  touchLastObservedAt(provider: PerformanceProvider, externalRecordId: string, observedAt: string): Promise<void>;
  list(query: AffiliatePerformanceQuery): Promise<PersistedAffiliatePerformanceMeasurement[]>;
}

export interface AffiliatePerformanceSaveResult {
  inputRecords: number;
  normalizedRecords: number;
  insertedRecords: number;
  duplicateRecords: number;
  duplicateRecordsDroppedInBatch: number;
}

export interface AffiliatePerformanceQuery {
  organizationId: string;
  brandId?: string;
  campaignId?: string;
  grain?: PerformanceGrain;
  channel?: PerformanceChannel;
  startDateOnOrAfter?: string;
  endDateExclusiveOnOrBefore?: string;
  limit?: number;
}

export interface AffiliatePerformanceStore {
  saveBatch(records: readonly AffiliatePerformanceRecord[]): Promise<AffiliatePerformanceSaveResult>;
  list(query: AffiliatePerformanceQuery): Promise<AffiliatePerformanceRecord[]>;
}
