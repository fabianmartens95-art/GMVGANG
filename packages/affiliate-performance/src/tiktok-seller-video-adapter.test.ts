import { describe, expect, it } from "vitest";
import type { ExternalConnection } from "@gmvgang/platform-foundation";
import {
  mapTikTokVideoPerformancePage,
  syncTikTokSellerVideoPerformance,
  type TikTokSellerVideoAnalyticsAuthorizedClient,
  type TikTokSellerVideoSyncInput,
  type TikTokVideoAttributionResolver
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

function input(overrides: Partial<TikTokSellerVideoSyncInput> = {}): TikTokSellerVideoSyncInput {
  return {
    connection: connection(),
    shopId: "shop-1",
    startDate: "2026-09-01",
    endDateExclusive: "2026-09-08",
    shopTimeZone: "Europe/Berlin",
    currency: "LOCAL",
    accountType: "AFFILIATE_ACCOUNTS",
    observedAt: "2026-09-09T06:00:00.000Z",
    brandId: "brand-1",
    ...overrides
  };
}

function resolver(): TikTokVideoAttributionResolver {
  return {
    async resolve(lookup) {
      return {
        creatorId: `creator-internal-${lookup.creatorOpenId.slice(-1)}`,
        contentId: `content-internal-${lookup.videoId}`,
        campaignId: "campaign-1",
        productId: "product-1"
      };
    }
  };
}

describe("TikTok v202605 video performance mapping", () => {
  it("maps additive video metrics to protected internal creator/content references", async () => {
    const lookups: unknown[] = [];
    const attribution: TikTokVideoAttributionResolver = {
      async resolve(lookup) {
        lookups.push(lookup);
        return {
          creatorId: "creator-master-7",
          contentId: "content-42",
          campaignId: "campaign-9",
          productId: "product-3"
        };
      }
    };

    const records = await mapTikTokVideoPerformancePage({
      videos: [{
        id: "video-42",
        title: "Provider title",
        username: "provider-user",
        creator: {
          open_id: "creator-open-id-7",
          user_name: "creator-user-name",
          nick_name: "creator-nick-name",
          author_type: "AFFILIATE"
        },
        duration: 25,
        hash_tags: ["#shop"],
        gmv: { amount: "250.50", currency: "EUR" },
        gpm: { amount: "12.75", currency: "EUR" },
        sku_orders: 5,
        items_sold: 6,
        views: 12000,
        click_through_rate: "0.081"
      }]
    }, input(), attribution);

    expect(lookups).toEqual([{
      organizationId: "org-1",
      connectionId: "conn-1",
      shopId: "shop-1",
      videoId: "video-42",
      creatorOpenId: "creator-open-id-7",
      authorType: "AFFILIATE"
    }]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      grain: "content",
      channel: "affiliate-video",
      currency: "EUR",
      dimensions: {
        organizationId: "org-1",
        brandId: "brand-1",
        campaignId: "campaign-9",
        shopId: "shop-1",
        productId: "product-3",
        creatorId: "creator-master-7",
        contentId: "content-42"
      },
      metrics: {
        gmv: 250.5,
        orders: 5,
        unitsSold: 6,
        views: 12000
      }
    });
    expect(records[0]?.metrics).not.toHaveProperty("gpm");
    expect(records[0]?.metrics).not.toHaveProperty("clickThroughRate");

    const canonical = JSON.stringify(records);
    expect(canonical).not.toContain("creator-open-id-7");
    expect(canonical).not.toContain("creator-user-name");
    expect(canonical).not.toContain("creator-nick-name");
    expect(canonical).not.toContain("provider-user");
  });

  it("maps official and marketing creators to seller-video when ALL is requested", async () => {
    const records = await mapTikTokVideoPerformancePage({
      videos: [
        {
          id: "official-video",
          creator: { open_id: "official-open", author_type: "OFFICIAL" },
          gmv: { amount: "10", currency: "EUR" },
          views: 100
        },
        {
          id: "channel-video",
          creator: { open_id: "channel-open", author_type: "CHANNEL" },
          gmv: { amount: "20", currency: "EUR" },
          views: 200
        }
      ]
    }, input({ accountType: "ALL" }), resolver());

    expect(records.map((record) => record.channel)).toEqual(["seller-video", "seller-video"]);
  });

  it("fails closed when provider account filtering and creator author type disagree", async () => {
    await expect(mapTikTokVideoPerformancePage({
      videos: [{
        id: "video-1",
        creator: { open_id: "creator-open", author_type: "OFFICIAL" },
        gmv: { amount: "10", currency: "EUR" }
      }]
    }, input({ accountType: "AFFILIATE_ACCOUNTS" }), resolver())).rejects.toThrow(
      "TIKTOK_VIDEO_ACCOUNT_TYPE_MISMATCH"
    );
  });

  it("fails closed when protected internal attribution cannot be resolved", async () => {
    const unresolved: TikTokVideoAttributionResolver = { resolve: async () => null };
    await expect(mapTikTokVideoPerformancePage({
      videos: [{
        id: "video-1",
        creator: { open_id: "creator-open", author_type: "AFFILIATE" },
        gmv: { amount: "10", currency: "EUR" }
      }]
    }, input(), unresolved)).rejects.toThrow("TIKTOK_VIDEO_ATTRIBUTION_UNRESOLVED");
  });
});

describe("TikTok v202605 video performance pagination", () => {
  it("walks page tokens with explicit affiliate account filtering and secret-free requests", async () => {
    const requests: unknown[] = [];
    const client: TikTokSellerVideoAnalyticsAuthorizedClient = {
      async getVideoPerformancePage(request) {
        requests.push(request);
        if (!request.pageToken) {
          return {
            videos: [{
              id: "video-1",
              creator: { open_id: "creator-open-1", author_type: "AFFILIATE" },
              gmv: { amount: "100", currency: "EUR" },
              sku_orders: 1,
              views: 1000
            }],
            nextPageToken: "page-2"
          };
        }
        return {
          videos: [{
            id: "video-2",
            creator: { open_id: "creator-open-2", author_type: "AFFILIATE" },
            gmv: { amount: "200", currency: "EUR" },
            sku_orders: 2,
            views: 2000
          }]
        };
      }
    };

    const batch = await syncTikTokSellerVideoPerformance(client, resolver(), input());
    expect(batch.records).toHaveLength(2);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ accountType: "AFFILIATE_ACCOUNTS", pageSize: 100 });
    expect(requests[1]).toMatchObject({ pageToken: "page-2" });
    const serialized = JSON.stringify(requests);
    expect(serialized).not.toContain("secret://");
    expect(serialized).not.toMatch(/accessToken|refreshToken|sign/i);
  });

  it("fails closed on a repeated pagination token", async () => {
    const client: TikTokSellerVideoAnalyticsAuthorizedClient = {
      async getVideoPerformancePage() {
        return { videos: [], nextPageToken: "same-token" };
      }
    };

    await expect(syncTikTokSellerVideoPerformance(client, resolver(), input())).rejects.toThrow(
      "TIKTOK_PAGINATION_TOKEN_LOOP"
    );
  });
});
