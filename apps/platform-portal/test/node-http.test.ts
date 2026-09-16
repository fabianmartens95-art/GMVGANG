import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";

import { requestBaseUrl } from "../server/node-http.js";

describe("requestBaseUrl", () => {
  it("prefers sanitized forwarded protocol and host", () => {
    const request = {
      headers: {
        host: "internal:4173",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.gmvgang.de",
      },
    } as unknown as IncomingMessage;
    expect(requestBaseUrl(request)).toBe("https://app.gmvgang.de");
  });

  it("falls back to http and the direct host", () => {
    const request = { headers: { host: "localhost:4173" } } as unknown as IncomingMessage;
    expect(requestBaseUrl(request)).toBe("http://localhost:4173");
  });
});
