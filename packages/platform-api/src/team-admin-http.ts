import { anyRoleHasCapability } from "@gmvgang/platform-foundation";
import type { PlatformApiDependencies } from "./types.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export async function handleTeamAdminOverview(
  request: Request,
  dependencies: PlatformApiDependencies,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  }

  const accessToken = (await dependencies.accessTokens.getAccessToken(request))?.trim();
  if (!accessToken) return jsonResponse({ error: "authentication_required" }, 401);

  const now = dependencies.clock.now();
  const context = await dependencies.services.resolveSessionContext({ accessToken, now });
  if (context.session.status !== "authenticated") {
    return jsonResponse({ error: "authentication_required" }, 401);
  }
  if (!anyRoleHasCapability(context.session.roles, "users.manage")) {
    return jsonResponse({ error: "admin_access_denied" }, 403);
  }
  if (!dependencies.services.getTeamAdminOverview) {
    return jsonResponse({ error: "admin_overview_unavailable" }, 503);
  }

  const model = await dependencies.services.getTeamAdminOverview({ now });
  return jsonResponse({ model, source: "production" });
}
