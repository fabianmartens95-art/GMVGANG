import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,80}$/;

export function requestIdFromHeader(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

export function withRequestId(request: Request, requestId: string): Request {
  const headers = new Headers(request.headers);
  headers.set("X-Request-Id", requestId);
  return new Request(request, { headers });
}

export function requestLogLevel(status: number): "info" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

export function requestLogEntry(input: {
  requestId: string;
  method?: string;
  path: string;
  status: number;
  durationMs: number;
}) {
  return {
    scope: "gmvgang.platform.http",
    level: requestLogLevel(input.status),
    requestId: input.requestId,
    method: input.method ?? "GET",
    path: input.path,
    status: input.status,
    durationMs: input.durationMs,
  };
}
