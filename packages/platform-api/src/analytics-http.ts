import { createPlatformApiHandler as createBasePlatformApiHandler } from "./http.js";
import type {
  PlatformApiDependencies,
  PortalAnalyticsEventName,
  PortalAnalyticsProperties,
} from "./types.js";

const ANALYTICS_ENDPOINT = "/api/analytics/events";
const EVENT_NAMES = new Set<PortalAnalyticsEventName>([
  "portal.page_view",
  "portal.navigation",
  "portal.sign_out_clicked",
  "creator.registration.submitted",
  "creator.profile.submitted",
  "creator.qualification.submitted",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function methodNotAllowed(): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "POST" });
}

function sameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return !fetchSite || fetchSite === "same-origin";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (
    !cleaned.startsWith("/") ||
    cleaned.startsWith("//") ||
    cleaned.includes("?") ||
    cleaned.includes("#") ||
    cleaned.includes("\\") ||
    cleaned.length > 512
  ) return null;
  return cleaned;
}

function parseProperties(value: unknown): PortalAnalyticsProperties | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "targetPath")) return null;

  const properties: Record<string, string> = {};
  if (value.targetPath !== undefined) {
    const targetPath = cleanPath(value.targetPath);
    if (!targetPath) return null;
    properties.targetPath = targetPath;
  }
  return properties;
}

function parseEvent(value: unknown): {
  eventName: PortalAnalyticsEventName;
  path: string;
  clientSessionId: string;
  properties: PortalAnalyticsProperties;
} | null {
  if (!isRecord(value)) return null;
  if (typeof value.eventName !== "string" || !EVENT_NAMES.has(value.eventName as PortalAnalyticsEventName)) return null;
  const path = cleanPath(value.path);
  if (!path) return null;
  if (typeof value.clientSessionId !== "string" || !UUID.test(value.clientSessionId)) return null;
  const properties = parseProperties(value.properties);
  if (!properties) return null;

  return {
    eventName: value.eventName as PortalAnalyticsEventName,
    path,
    clientSessionId: value.clientSessionId,
    properties,
  };
}

async function handleAnalyticsEvent(
  request: Request,
  dependencies: PlatformApiDependencies,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  if (!sameOriginMutation(request)) return jsonResponse({ error: "same_origin_required" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "json_required" }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const event = parseEvent(payload);
  if (!event) return jsonResponse({ error: "invalid_analytics_event" }, 400);

  const accessToken = (await dependencies.accessTokens.getAccessToken(request))?.trim();
  if (!accessToken) return jsonResponse({ error: "authentication_required" }, 401);

  const occurredAt = dependencies.clock.now();
  const context = await dependencies.services.resolveSessionContext({ accessToken, now: occurredAt });
  if (context.session.status !== "authenticated") {
    return jsonResponse({ error: "authentication_required" }, 401);
  }
  if (!dependencies.services.recordAnalyticsEvent) {
    return jsonResponse({ error: "analytics_unavailable" }, 503);
  }

  const requestId = request.headers.get("X-Request-Id")?.trim();
  await dependencies.services.recordAnalyticsEvent({
    userId: context.session.userId,
    ...(context.session.organizationId ? { organizationId: context.session.organizationId } : {}),
    eventName: event.eventName,
    path: event.path,
    clientSessionId: event.clientSessionId,
    ...(requestId && requestId.length <= 128 ? { requestId } : {}),
    properties: event.properties,
    occurredAt,
  });

  return jsonResponse({ ok: true }, 202);
}

export function createPlatformApiHandler(
  dependencies: PlatformApiDependencies,
): (request: Request) => Promise<Response> {
  const baseHandler = createBasePlatformApiHandler(dependencies);

  return async (request: Request): Promise<Response> => {
    if (new URL(request.url).pathname !== ANALYTICS_ENDPOINT) return baseHandler(request);

    try {
      return await handleAnalyticsEvent(request, dependencies);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "ANALYTICS_FAILED";
      console.error("GMVGANG_ANALYTICS_EVENT_FAILED", { code });
      return jsonResponse({ error: "internal_error" }, 500);
    }
  };
}
