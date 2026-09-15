import { describe, expect, it } from "vitest";
import type { ExternalConnection } from "@gmvgang/platform-foundation";
import {
  assertTikTokSellerAnalyticsConnection,
  mapTikTokProductPerformancePage,
  syncTikTokSellerProductPerformance,
  type TikTokSellerAnalyticsAuthorizedClient,
  type TikTokSellerProductSyncInput
} from "./index.js";

function connection(overrides: Partial<ExternalConnection> = {}): ExternalConnection {
  return {
    id: "conn-1",
    ownerType: "organization",
    ownerId: "org-1",
    provider: "tiktok_shop_seller",
    status: "connected",
    market: "DE",
    externalAccountId: "seller-account-1",
    externalShopIds: ["shop-1"],
    grantedScopes: ["data.shop_analytics.public.read"],
    accessTokenSecretRef: "secret://seller/access",
    refreshTokenSecretRef: "secret://seller/refresh",
    tokenExpiresAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

function input(overrides: Partial<TikTokSellerProductSyncInput> = {}): TikTokSellerProductSyncInput {
  return {
    connection: connection(),
    shopId: "shop-1",
    startDate: "2026-09-01",
    endDateExclusive: "2026-09-08",
    shopTimeZone: "Europe/Berlin",
    currency: "LOCAL",
    observedAt: "2026-09-09T06:00:00.000Z",
    brandId: "brand-1",
    ...overrides
  };
}

describe("TikTok seller analytics connection gate", () => {
  it("accepts a syncable seller connection with analytics scope and authorized shop", () => {
    expect(() => assertTikTokSellerAnalyticsConnection(connection(), "shop-1", "2026-09-09T06:00:00.000Z")).not.toThrow();
  });

  it("fails closed for missing scope, unauthorized shop and expired connection", () => {
    expect(() => assertTikTokSellerAnalyticsConnection(
      connection({ grantedScopes: [] }),
      "shop-1",
      "2026-09-09T06:00:00.000Z"
    )).toThrow("TIKTOK_SHOP_ANALYTICS_SCOPE_MISSING");

    expect(() => assertTikTokSellerAnalyticsConnection(
      connection(),
      "shop-2",
      "2026-09-09T06:00:00.000Z"
    )).toThrow("TIKTOK_SHOP_NOT_AUTHORIZED_FOR_CONNECTION");

    expect(() => assertTikTokSellerAnalyticsConnection(
      connection({ tokenExpiresAt: "2026-09-08T00:00:00.000Z" }),
      "shop-1",
      "2026-09-09T06:00:00.000Z"
    )).toThrow("TIKTOK_SELLER_CONNECTION_NOT_SYNCABLE");
  });
});

describe("TikTok product performance mapping", () => {
  it("maps total and affiliate-total additive metrics without trusting provider ratios", () => {
    const records = mapTikTokProductPerformancePage({
      products: [{
        id: "product-1",
        total_performance: {
          gmv: { amount: "300.50", currency: "EUR" },
          orders: 3,
          items_sold: 4,
          product_impressions: 3000,
          product_clicks: 300,
          add_cart_count: 75,
          refunds: { amount: "30.00", currency: "EUR" },
          refunded_items: 1
        },
        affiliate_total_performance: {
          gmv: { amount: "200.00", currency: "EUR" },
          orders: 2,
          items_sold: 2,
          product_impressions: 2000,
          product_clicks: 200
        }
      }]
    }, input());

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      grain: "product",
      channel: "total",
      currency: "EUR",
      metrics: {
        gmv: 300.5,
        orders: 3,
        unitsSold: 4,
        impressions: 3000,
        clicks: 300,
        addToCart: 75,
        refunds: 30,
        refundedItems: 1
      }
    });
    expect(records[1]).toMatchObject({
      channel: "affiliate-total",
      metrics: { gmv: 200, orders: 2, unitsSold: 2, impressions: 2000, clicks: 200 }
    });
    expect(records[0]?.dimensions).toMatchObject({
      organizationId: "org-1",
      brandId: "brand-1",
      shopId: "shop-1",
      productId: "product-1"
    });
  });

  it("rejects conflicting monetary currencies", () => {
    expect(() => mapTikTokProductPerformancePage({
      products: [{
        id: "product-1",
        total_performance: {
          gmv: { amount: "100", currency: "EUR" },
          refunds: { amount: "10", currency: "USD" }
        }
      }]
    }, input())).toThrow("TIKTOK_PRODUCT_PERFORMANCE_CURRENCY_CONFLICT");
  });
});

describe("TikTok product performance pagination", () => {
  it("walks page tokens and never exposes secret refs or tokens to the authorized client", async () => {
    const requests: unknown[] = [];
    const client: TikTokSellerAnalyticsAuthorizedClient = {
      async getProductPerformancePage(request) {
        requests.push(request);
        if (!request.pageToken) {
          return {
            products: [{
              id: "product-1",
              affiliate_total_performance: {
                gmv: { amount: "100", currency: "EUR" },
                orders: 1
              }
            }],
            nextPageToken: "page-2"
          };
        }
        return {
          products: [{
            id: "product-2",
            affiliate_total_performance: {
              gmv: { amount: "200", currency: "EUR" },
              orders: 2
            }
          }]
        };
      }
    };

    const batch = await syncTikTokSellerProductPerformance(client, input());
    expect(batch.records).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ pageToken: "page-2", pageSize: 100 });
    const serialized = JSON.stringify(requests);
    expect(serialized).not.toContain("secret://");
    expect(serialized).not.toMatch(/accessToken|refreshToken|sign/i);
  });

  it("fails closed on a repeated pagination token", async () => {
    const client: TikTokSellerAnalyticsAuthorizedClient = {
      async getProductPerformancePage() {
        return { products: [], nextPageToken: "same-token" };
      }
    };

    await expect(syncTikTokSellerProductPerformance(client, input())).rejects.toThrow("TIKTOK_PAGINATION_TOKEN_LOOP");
  });

  it("enforces a bounded maximum page count", async () => {
    let page = 0;
    const client: TikTokSellerAnalyticsAuthorizedClient = {
      async getProductPerformancePage() {
        page += 1;
        return { products: [], nextPageToken: `page-${page}` };
      }
    };

    await expect(syncTikTokSellerProductPerformance(client, input({ maxPages: 2 }))).rejects.toThrow(
      "TIKTOK_PAGINATION_PAGE_LIMIT_EXCEEDED"
    );
  });
});
