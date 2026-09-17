import { describe, expect, it } from "vitest";

import {
  requestIdFromHeader,
  requestLogEntry,
  requestLogLevel,
  withRequestId,
} from "../src/request-context.js";

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

  it("classifies request severity without inspecting request bodies", () => {
    expect(requestLogLevel(200)).toBe("info");
    expect(requestLogLevel(404)).toBe("warn");
    expect(requestLogLevel(500)).toBe("error");
    expect(requestLogLevel(503)).toBe("error");
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
      level: "info",
      requestId: "req_abcdefgh",
      method: "POST",
      path: "/api/creator/profile",
      status: 200,
      durationMs: 17,
    });
  });

  it("marks server failures as error-level structured events", () => {
    expect(requestLogEntry({
      requestId: "req_server500",
      method: "GET",
      path: "/api/team/creator-funnel",
      status: 500,
      durationMs: 41,
    })).toMatchObject({
      scope: "gmvgang.platform.http",
      level: "error",
      requestId: "req_server500",
      status: 500,
    });
  });
});
