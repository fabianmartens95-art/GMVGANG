import { describe, expect, it } from "vitest";

import { requestIdFromHeader, requestLogEntry, withRequestId } from "../src/request-context.js";

describe("request correlation", () => {
  it("preserves a valid upstream request id", () => {
    expect(requestIdFromHeader("req_12345678")).toBe("req_12345678");
  });

  it("replaces invalid request ids", () => {
    const requestId = requestIdFromHeader("bad id");
    expect(requestId).not.toBe("bad id");
    expect(requestId.length).toBeGreaterThanOrEqual(8);
  });

  it("injects the correlation id into the internal request", () => {
    const request = withRequestId(new Request("https://app.gmvgang.de/api/session"), "req_abcdefgh");
    expect(request.headers.get("X-Request-Id")).toBe("req_abcdefgh");
  });

  it("creates a stable structured access-log payload", () => {
    expect(requestLogEntry({
      requestId: "req_abcdefgh",
      method: "POST",
      path: "/api/creator/profile",
      status: 200,
      durationMs: 17,
    })).toEqual({
      scope: "gmvgang.platform.http",
      requestId: "req_abcdefgh",
      method: "POST",
      path: "/api/creator/profile",
      status: 200,
      durationMs: 17,
    });
  });
});
