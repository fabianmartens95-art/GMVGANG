import { describe, expect, it } from "vitest";
import { FetchTikTokHttpTransport } from "./fetch-transport.js";

describe("FetchTikTokHttpTransport", () => {
  it("forwards method, headers and body and returns normalized response headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response("{\"ok\":true}", {
        status: 200,
        headers: { "x-request-id": "req-1" }
      });
    };
    const transport = new FetchTikTokHttpTransport({ fetchImpl, timeoutMs: 1000 });

    const response = await transport.send({
      method: "POST",
      url: "https://example.test/path",
      headers: { authorization: "Bearer hidden" },
      body: "payload"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/path");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual({ authorization: "Bearer hidden" });
    expect(calls[0]?.init.body).toBe("payload");
    expect(response).toEqual({
      status: 200,
      body: "{\"ok\":true}",
      headers: { "content-type": "text/plain;charset=UTF-8", "x-request-id": "req-1" }
    });
  });

  it("aborts a request after the configured timeout", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return reject(new Error("SIGNAL_MISSING"));
        if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    };
    const transport = new FetchTikTokHttpTransport({ fetchImpl, timeoutMs: 5 });

    await expect(transport.send({ method: "GET", url: "https://example.test/hang", headers: {} })).rejects.toMatchObject({
      name: "AbortError"
    });
  });

  it("rejects invalid timeout configuration", () => {
    expect(() => new FetchTikTokHttpTransport({ timeoutMs: 0 })).toThrow("TIKTOK_HTTP_TIMEOUT_INVALID");
  });
});
