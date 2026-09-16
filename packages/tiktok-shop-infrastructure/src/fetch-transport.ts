import type { TikTokHttpRequest, TikTokHttpResponse, TikTokHttpTransport } from "./ports.js";

export interface FetchTikTokHttpTransportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class FetchTikTokHttpTransport implements TikTokHttpTransport {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: FetchTikTokHttpTransportOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("TIKTOK_HTTP_TIMEOUT_INVALID");
  }

  async send(request: TikTokHttpRequest): Promise<TikTokHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body !== undefined ? { body: request.body } : {}),
        signal: controller.signal
      });
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { status: response.status, body, headers };
    } finally {
      clearTimeout(timeout);
    }
  }
}
