import { describe, expect, it } from "vitest";
import type { TikTokSellerVideoPageRequest } from "@gmvgang/affiliate-performance";
import type { ExternalConnection } from "@gmvgang/platform-foundation";
import {
  TikTokSellerAnalyticsInfrastructureClient,
  type SecretResolver,
  type TikTokHttpRequest,
  type TikTokHttpResponse,
  type TikTokHttpTransport,
  type TikTokShopConnectionResolver
} from "./index.js";

function connection(): ExternalConnection {
  return {
    id: "conn-1",
    ownerType: "organization",
    ownerId: "org-1",
    provider: "tiktok_shop_seller",
    status: "connected",
    market: "DE",
    externalAccountId: "seller-1",
    externalShopIds: ["shop-1"],
    grantedScopes: ["data.shop_analytics.public.read"],
    accessTokenSecretRef: "secret://seller/access",
    refreshTokenSecretRef: "secret://seller/refresh",
    tokenExpiresAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  };
}

function pageRequest(overrides: Partial<TikTokSellerVideoPageRequest> = {}): TikTokSellerVideoPageRequest {
  return {
    connectionId: "conn-1",
    shopId: "shop-1",
    startDate: "2026-09-01",
    endDateExclusive: "2026-09-08",
    shopTimeZone: "Europe/Berlin",
    currency: "LOCAL",
    accountType: "AFFILIATE_ACCOUNTS",
    pageSize: 100,
    ...overrides
  };
}

class QueueTransport implements TikTokHttpTransport {
  readonly requests: TikTokHttpRequest[] = [];
  private readonly responses: TikTokHttpResponse[];

  constructor(responses: TikTokHttpResponse[]) {
    this.responses = [...responses];
  }

  async send(request: TikTokHttpRequest): Promise<TikTokHttpResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) throw new Error("TEST_RESPONSE_QUEUE_EMPTY");
    return response;
  }
}

function ok(body: unknown): TikTokHttpResponse {
  return { status: 200, body: JSON.stringify(body) };
}

function makeClient(transport: TikTokHttpTransport) {
  const connections: TikTokShopConnectionResolver = {
    async getConnection() {
      return connection();
    }
  };
  const secrets: SecretResolver = {
    async getSecret(secretRef) {
      if (secretRef === "secret://seller/access") return "seller-access-token";
      if (secretRef === "secret://app") return "app-secret-value";
      throw new Error("UNEXPECTED_SECRET_REF");
    }
  };

  return new TikTokSellerAnalyticsInfrastructureClient({
    app: {
      appKey: "app-key",
      appSecretRef: "secret://app",
      baseUrl: "https://example.test"
    },
    connections,
    secrets,
    transport,
    clock: { unixSeconds: () => 1_779_000_000 },
    sleeper: { sleep: async () => undefined }
  });
}

describe("TikTok Seller Analytics v202605 video client", () => {
  it("resolves shop cipher, signs the video request and preserves creator attribution only in provider response", async () => {
    const transport = new QueueTransport([
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({
        code: 0,
        data: {
          videos: [{
            id: "video-1",
            creator: { open_id: "creator-open-1", author_type: "AFFILIATE" },
            gmv: { amount: "125.50", currency: "EUR" },
            sku_orders: 2,
            views: 9000
          }],
          next_page_token: "page-2"
        },
        request_id: "video-performance-req"
      })
    ]);
    const client = makeClient(transport);

    const page = await client.getVideoPerformancePage(pageRequest());

    expect(page).toMatchObject({
      requestId: "video-performance-req",
      nextPageToken: "page-2",
      videos: [{ id: "video-1", creator: { author_type: "AFFILIATE" } }]
    });
    expect(transport.requests).toHaveLength(2);

    const performanceUrl = new URL(transport.requests[1]!.url);
    expect(performanceUrl.pathname).toBe("/analytics/202605/shop_videos/performance");
    expect(performanceUrl.searchParams.get("account_type")).toBe("AFFILIATE_ACCOUNTS");
    expect(performanceUrl.searchParams.get("shop_cipher")).toBe("cipher-1");
    expect(performanceUrl.searchParams.get("page_size")).toBe("100");
    expect(performanceUrl.searchParams.get("sign")).toMatch(/^[a-f0-9]{64}$/);
    expect(performanceUrl.searchParams.get("access_token")).toBeNull();
    expect(transport.requests[1]!.headers["x-tts-access-token"]).toBe("seller-access-token");

    const serializedRequests = JSON.stringify(transport.requests);
    expect(serializedRequests).not.toContain("secret://");
    expect(serializedRequests).not.toContain("app-secret-value");
  });

  it("reuses cached shop cipher across video pages", async () => {
    const transport = new QueueTransport([
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({ code: 0, data: { videos: [], next_page_token: "page-2" } }),
      ok({ code: 0, data: { videos: [] } })
    ]);
    const client = makeClient(transport);

    await client.getVideoPerformancePage(pageRequest());
    await client.getVideoPerformancePage(pageRequest({ pageToken: "page-2" }));

    expect(transport.requests).toHaveLength(3);
    expect(transport.requests.filter((request) => new URL(request.url).pathname === "/authorization/202309/shops")).toHaveLength(1);
    expect(new URL(transport.requests[2]!.url).searchParams.get("page_token")).toBe("page-2");
  });

  it("fails closed when the provider envelope omits videos", async () => {
    const transport = new QueueTransport([
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({ code: 0, data: {} })
    ]);
    const client = makeClient(transport);

    await expect(client.getVideoPerformancePage(pageRequest())).rejects.toThrow(
      "TIKTOK_VIDEO_PERFORMANCE_VIDEOS_MISSING"
    );
  });
});
