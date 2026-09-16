import { describe, expect, it } from "vitest";
import type { TikTokSellerProductPageRequest } from "@gmvgang/affiliate-performance";
import type { ExternalConnection } from "@gmvgang/platform-foundation";
import {
  TikTokSellerAnalyticsInfrastructureClient,
  TikTokShopApiError,
  type SecretResolver,
  type TikTokHttpRequest,
  type TikTokHttpResponse,
  type TikTokHttpTransport,
  type TikTokShopConnectionResolver,
  type TikTokSleeper
} from "./index.js";

function connection(overrides: Partial<ExternalConnection> = {}): ExternalConnection {
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
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

function pageRequest(overrides: Partial<TikTokSellerProductPageRequest> = {}): TikTokSellerProductPageRequest {
  return {
    connectionId: "conn-1",
    shopId: "shop-1",
    startDate: "2026-09-01",
    endDateExclusive: "2026-09-08",
    shopTimeZone: "Europe/Berlin",
    currency: "LOCAL",
    pageSize: 100,
    ...overrides
  };
}

class QueueTransport implements TikTokHttpTransport {
  readonly requests: TikTokHttpRequest[] = [];
  private readonly responses: Array<TikTokHttpResponse | Error>;

  constructor(responses: Array<TikTokHttpResponse | Error>) {
    this.responses = [...responses];
  }

  async send(request: TikTokHttpRequest): Promise<TikTokHttpResponse> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error("TEST_RESPONSE_QUEUE_EMPTY");
    if (next instanceof Error) throw next;
    return next;
  }
}

function ok(body: unknown): TikTokHttpResponse {
  return { status: 200, body: JSON.stringify(body) };
}

function makeClient(options: {
  transport: TikTokHttpTransport;
  connection?: ExternalConnection | null;
  sleeper?: TikTokSleeper;
  maxAttempts?: number;
}) {
  const connections: TikTokShopConnectionResolver = {
    async getConnection() {
      return options.connection === undefined ? connection() : options.connection;
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
    transport: options.transport,
    clock: { unixSeconds: () => 1_779_000_000 },
    sleeper: options.sleeper ?? { sleep: async () => undefined },
    ...(options.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {})
  });
}

describe("TikTok Seller Analytics infrastructure client", () => {
  it("resolves shop cipher, signs requests and maps the provider envelope without leaking secret refs", async () => {
    const transport = new QueueTransport([
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] }, request_id: "shops-req" }),
      ok({
        code: 0,
        data: {
          products: [{
            id: "product-1",
            total_performance: { gmv: { amount: "125.50", currency: "EUR" }, orders: 2 }
          }],
          next_page_token: "page-2"
        },
        request_id: "performance-req"
      })
    ]);
    const client = makeClient({ transport });

    const page = await client.getProductPerformancePage(pageRequest());

    expect(page).toMatchObject({
      requestId: "performance-req",
      nextPageToken: "page-2",
      products: [{ id: "product-1" }]
    });
    expect(transport.requests).toHaveLength(2);

    const shopsUrl = new URL(transport.requests[0]!.url);
    expect(shopsUrl.pathname).toBe("/authorization/202309/shops");
    expect(shopsUrl.searchParams.get("app_key")).toBe("app-key");
    expect(shopsUrl.searchParams.get("timestamp")).toBe("1779000000");
    expect(shopsUrl.searchParams.get("sign")).toMatch(/^[a-f0-9]{64}$/);

    const performanceUrl = new URL(transport.requests[1]!.url);
    expect(performanceUrl.pathname).toBe("/analytics/202605/shop_products/performance");
    expect(performanceUrl.searchParams.get("shop_cipher")).toBe("cipher-1");
    expect(performanceUrl.searchParams.get("page_size")).toBe("100");
    expect(performanceUrl.searchParams.get("access_token")).toBeNull();
    expect(transport.requests[1]!.headers["x-tts-access-token"]).toBe("seller-access-token");

    const serialized = JSON.stringify(transport.requests);
    expect(serialized).not.toContain("secret://");
    expect(serialized).not.toContain("app-secret-value");
  });

  it("caches shop cipher per connection and shop", async () => {
    const transport = new QueueTransport([
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({ code: 0, data: { products: [] } }),
      ok({ code: 0, data: { products: [] } })
    ]);
    const client = makeClient({ transport });

    await client.getProductPerformancePage(pageRequest());
    await client.getProductPerformancePage(pageRequest({ pageToken: "page-2" }));

    expect(transport.requests).toHaveLength(3);
    expect(transport.requests.filter((request) => new URL(request.url).pathname === "/authorization/202309/shops")).toHaveLength(1);
    expect(new URL(transport.requests[2]!.url).searchParams.get("page_token")).toBe("page-2");
  });

  it("retries 429 with bounded exponential backoff", async () => {
    const sleeps: number[] = [];
    const sleeper: TikTokSleeper = { sleep: async (milliseconds) => { sleeps.push(milliseconds); } };
    const transport = new QueueTransport([
      { status: 429, body: "rate limited" },
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({ code: 0, data: { products: [] } })
    ]);
    const client = makeClient({ transport, sleeper });

    await client.getProductPerformancePage(pageRequest());

    expect(sleeps).toEqual([250]);
    expect(transport.requests).toHaveLength(3);
  });

  it("does not retry non-transient HTTP authorization failures", async () => {
    const sleeps: number[] = [];
    const sleeper: TikTokSleeper = { sleep: async (milliseconds) => { sleeps.push(milliseconds); } };
    const transport = new QueueTransport([{ status: 401, body: "unauthorized" }]);
    const client = makeClient({ transport, sleeper, maxAttempts: 3 });

    await expect(client.getProductPerformancePage(pageRequest())).rejects.toThrow("TIKTOK_HTTP_STATUS_401");
    expect(transport.requests).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("retries documented transient TikTok API codes but preserves terminal request id", async () => {
    const sleeps: number[] = [];
    const sleeper: TikTokSleeper = { sleep: async (milliseconds) => { sleeps.push(milliseconds); } };
    const transport = new QueueTransport([
      ok({ code: 36009002, data: {}, request_id: "transient" }),
      ok({ code: 0, data: { shops: [{ id: "shop-1", cipher: "cipher-1" }] } }),
      ok({ code: 123456, data: {}, request_id: "terminal-req" })
    ]);
    const client = makeClient({ transport, sleeper });

    try {
      await client.getProductPerformancePage(pageRequest());
      throw new Error("EXPECTED_FAILURE");
    } catch (error) {
      expect(error).toBeInstanceOf(TikTokShopApiError);
      expect((error as TikTokShopApiError).apiCode).toBe(123456);
      expect((error as TikTokShopApiError).requestId).toBe("terminal-req");
    }
    expect(sleeps).toEqual([250]);
  });

  it("fails closed before any HTTP call when connection cannot be resolved", async () => {
    const transport = new QueueTransport([]);
    const client = makeClient({ transport, connection: null });

    await expect(client.getProductPerformancePage(pageRequest())).rejects.toThrow("TIKTOK_CONNECTION_NOT_FOUND");
    expect(transport.requests).toHaveLength(0);
  });
});
