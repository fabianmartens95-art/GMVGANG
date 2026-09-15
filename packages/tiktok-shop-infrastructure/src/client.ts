import type {
  TikTokSellerAnalyticsAuthorizedClient,
  TikTokSellerProductPerformancePage,
  TikTokSellerProductPageRequest
} from "@gmvgang/affiliate-performance";
import {
  assertConnectionOwnership,
  canSyncConnection,
  type ExternalConnection
} from "@gmvgang/platform-foundation";
import type {
  SecretResolver,
  TikTokClock,
  TikTokHttpResponse,
  TikTokHttpTransport,
  TikTokShopAppConfig,
  TikTokShopConnectionResolver,
  TikTokSleeper
} from "./ports.js";
import { systemTikTokClock, systemTikTokSleeper } from "./ports.js";
import { signTikTokShopRequest } from "./sign.js";

const PRODUCT_PERFORMANCE_PATH = "/analytics/202605/shop_products/performance";
const AUTHORIZED_SHOPS_PATH = "/authorization/202309/shops";
const TRANSIENT_TIKTOK_CODES = new Set([36009002, 36009003]);

interface TikTokEnvelope<T> {
  code: number;
  data: T;
  message?: string;
  request_id?: string;
}

interface AuthorizedShop {
  id: string;
  cipher: string;
}

interface AuthorizedShopsData {
  shops: AuthorizedShop[];
}

interface ProductPerformanceData {
  products: TikTokSellerProductPerformancePage["products"];
  next_page_token?: string;
}

export class TikTokShopApiError extends Error {
  readonly apiCode: number;
  readonly requestId: string | null;

  constructor(apiCode: number, requestId?: string) {
    super(`TIKTOK_SHOP_API_ERROR_${apiCode}`);
    this.name = "TikTokShopApiError";
    this.apiCode = apiCode;
    this.requestId = requestId?.trim() || null;
  }
}

export interface TikTokSellerAnalyticsInfrastructureClientOptions {
  app: TikTokShopAppConfig;
  connections: TikTokShopConnectionResolver;
  secrets: SecretResolver;
  transport: TikTokHttpTransport;
  clock?: TikTokClock;
  sleeper?: TikTokSleeper;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

interface ResolvedConnectionSecrets {
  connection: ExternalConnection;
  accessToken: string;
  appSecret: string;
}

function requireText(value: string, code: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(code);
  return trimmed;
}

function parseEnvelope<T>(body: string): TikTokEnvelope<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("TIKTOK_RESPONSE_INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("TIKTOK_RESPONSE_INVALID_ENVELOPE");
  const record = parsed as Record<string, unknown>;
  if (typeof record.code !== "number") throw new Error("TIKTOK_RESPONSE_CODE_MISSING");
  return {
    code: record.code,
    data: record.data as T,
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(typeof record.request_id === "string" ? { request_id: record.request_id } : {})
  };
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class TikTokSellerAnalyticsInfrastructureClient implements TikTokSellerAnalyticsAuthorizedClient {
  private readonly app: TikTokShopAppConfig;
  private readonly connections: TikTokShopConnectionResolver;
  private readonly secrets: SecretResolver;
  private readonly transport: TikTokHttpTransport;
  private readonly clock: TikTokClock;
  private readonly sleeper: TikTokSleeper;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly shopCipherCache = new Map<string, string>();

  constructor(options: TikTokSellerAnalyticsInfrastructureClientOptions) {
    this.app = options.app;
    this.connections = options.connections;
    this.secrets = options.secrets;
    this.transport = options.transport;
    this.clock = options.clock ?? systemTikTokClock;
    this.sleeper = options.sleeper ?? systemTikTokSleeper;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 250;

    requireText(this.app.appKey, "TIKTOK_APP_KEY_MISSING");
    requireText(this.app.appSecretRef, "TIKTOK_APP_SECRET_REF_MISSING");
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts <= 0) throw new Error("TIKTOK_MAX_ATTEMPTS_INVALID");
    if (!Number.isFinite(this.retryBaseDelayMs) || this.retryBaseDelayMs < 0) {
      throw new Error("TIKTOK_RETRY_DELAY_INVALID");
    }
  }

  async getProductPerformancePage(
    request: TikTokSellerProductPageRequest
  ): Promise<TikTokSellerProductPerformancePage> {
    const resolved = await this.resolveConnectionSecrets(request.connectionId, request.shopId);
    const shopCipher = await this.resolveShopCipher(resolved, request.shopId);
    const query: Record<string, string> = {
      start_date_ge: request.startDate,
      end_date_lt: request.endDateExclusive,
      page_size: String(request.pageSize),
      currency: request.currency,
      shop_cipher: shopCipher,
      ...(request.pageToken ? { page_token: request.pageToken } : {})
    };

    const envelope = await this.signedGet<ProductPerformanceData>(
      PRODUCT_PERFORMANCE_PATH,
      query,
      resolved.accessToken,
      resolved.appSecret
    );
    if (!envelope.data || !Array.isArray(envelope.data.products)) {
      throw new Error("TIKTOK_PRODUCT_PERFORMANCE_PRODUCTS_MISSING");
    }

    const nextPageToken = envelope.data.next_page_token?.trim();
    return {
      products: envelope.data.products,
      ...(nextPageToken ? { nextPageToken } : {}),
      ...(envelope.request_id ? { requestId: envelope.request_id } : {})
    };
  }

  private async resolveConnectionSecrets(connectionId: string, shopId: string): Promise<ResolvedConnectionSecrets> {
    const connection = await this.connections.getConnection(requireText(connectionId, "TIKTOK_CONNECTION_ID_MISSING"));
    if (!connection) throw new Error("TIKTOK_CONNECTION_NOT_FOUND");
    assertConnectionOwnership(connection);
    if (connection.provider !== "tiktok_shop_seller") throw new Error("WRONG_TIKTOK_CONNECTION_PROVIDER");
    const now = new Date(this.clock.unixSeconds() * 1000).toISOString();
    if (!canSyncConnection(connection, now)) throw new Error("TIKTOK_SELLER_CONNECTION_NOT_SYNCABLE");
    if (!(connection.externalShopIds ?? []).includes(shopId)) throw new Error("TIKTOK_SHOP_NOT_AUTHORIZED_FOR_CONNECTION");
    if (!connection.accessTokenSecretRef) throw new Error("TIKTOK_ACCESS_TOKEN_SECRET_REF_MISSING");

    const [accessToken, appSecret] = await Promise.all([
      this.secrets.getSecret(connection.accessTokenSecretRef),
      this.secrets.getSecret(this.app.appSecretRef)
    ]);
    return {
      connection,
      accessToken: requireText(accessToken, "TIKTOK_ACCESS_TOKEN_MISSING"),
      appSecret: requireText(appSecret, "TIKTOK_APP_SECRET_MISSING")
    };
  }

  private async resolveShopCipher(resolved: ResolvedConnectionSecrets, shopId: string): Promise<string> {
    const cacheKey = `${resolved.connection.id}:${shopId}`;
    const cached = this.shopCipherCache.get(cacheKey);
    if (cached) return cached;

    const envelope = await this.signedGet<AuthorizedShopsData>(
      AUTHORIZED_SHOPS_PATH,
      {},
      resolved.accessToken,
      resolved.appSecret
    );
    if (!envelope.data || !Array.isArray(envelope.data.shops)) {
      throw new Error("TIKTOK_AUTHORIZED_SHOPS_MISSING");
    }
    const shop = envelope.data.shops.find((candidate) => candidate?.id === shopId);
    const cipher = shop?.cipher?.trim();
    if (!cipher) throw new Error("TIKTOK_SHOP_CIPHER_NOT_FOUND");
    this.shopCipherCache.set(cacheKey, cipher);
    return cipher;
  }

  private async signedGet<T>(
    path: string,
    businessQuery: Readonly<Record<string, string>>,
    accessToken: string,
    appSecret: string
  ): Promise<TikTokEnvelope<T>> {
    let lastTransportFailure: unknown = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const timestamp = String(this.clock.unixSeconds());
      const unsignedQuery: Record<string, string> = {
        ...businessQuery,
        app_key: this.app.appKey,
        timestamp
      };
      const sign = signTikTokShopRequest({ path, query: unsignedQuery, appSecret });
      const query = new URLSearchParams({ ...unsignedQuery, sign });
      const baseUrl = (this.app.baseUrl ?? "https://open-api.tiktokglobalshop.com").replace(/\/$/, "");
      const url = `${baseUrl}${path}?${query.toString()}`;

      let response: TikTokHttpResponse;
      try {
        response = await this.transport.send({
          method: "GET",
          url,
          headers: {
            "content-type": "application/json",
            "x-tts-access-token": accessToken
          }
        });
      } catch (error) {
        lastTransportFailure = error;
        if (attempt < this.maxAttempts) {
          await this.sleepForAttempt(attempt);
          continue;
        }
        throw new Error("TIKTOK_HTTP_TRANSPORT_FAILED");
      }

      if (isRetryableHttpStatus(response.status)) {
        if (attempt < this.maxAttempts) {
          await this.sleepForAttempt(attempt);
          continue;
        }
        throw new Error(`TIKTOK_HTTP_STATUS_${response.status}`);
      }
      if (response.status < 200 || response.status >= 300) throw new Error(`TIKTOK_HTTP_STATUS_${response.status}`);

      const envelope = parseEnvelope<T>(response.body);
      if (envelope.code === 0) return envelope;
      if (TRANSIENT_TIKTOK_CODES.has(envelope.code) && attempt < this.maxAttempts) {
        await this.sleepForAttempt(attempt);
        continue;
      }
      throw new TikTokShopApiError(envelope.code, envelope.request_id);
    }

    void lastTransportFailure;
    throw new Error("TIKTOK_HTTP_TRANSPORT_FAILED");
  }

  private async sleepForAttempt(attempt: number): Promise<void> {
    await this.sleeper.sleep(this.retryBaseDelayMs * 2 ** (attempt - 1));
  }
}
