import type { Membership, PlatformUserRole } from "@gmvgang/platform-foundation";
import type { PlatformApiDependencies } from "./types.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];
const STATUSES: readonly Membership["status"][] = ["invited", "active", "revoked"];

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
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

function parseInput(value: unknown): {
  targetUserId: string;
  organizationId: string;
  role: PlatformUserRole;
  status: Membership["status"];
} | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.targetUserId !== "string" || !UUID.test(value.targetUserId.trim()) ||
    typeof value.organizationId !== "string" || !UUID.test(value.organizationId.trim()) ||
    typeof value.role !== "string" || !ROLES.includes(value.role as PlatformUserRole) ||
    typeof value.status !== "string" || !STATUSES.includes(value.status as Membership["status"])
  ) return null;

  return {
    targetUserId: value.targetUserId.trim(),
    organizationId: value.organizationId.trim(),
    role: value.role as PlatformUserRole,
    status: value.status as Membership["status"],
  };
}

function publicMembership(membership: Membership): unknown {
  return {
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

function membershipError(error: unknown): Response {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  if (
    code === "MEMBERSHIP_MANAGEMENT_DENIED" ||
    code === "FOUNDER_ROLE_PROTECTED" ||
    code === "ADMIN_ROLE_REQUIRES_FOUNDER" ||
    code === "MEMBERSHIP_ROLE_SCOPE_MISMATCH" ||
    code === "ORGANIZATION_ACCESS_DENIED"
  ) return jsonResponse({ ok: false, error: code.toLowerCase() }, 403);
  if (code === "MEMBERSHIP_TARGET_USER_NOT_FOUND" || code === "MEMBERSHIP_NOT_FOUND") {
    return jsonResponse({ ok: false, error: code.toLowerCase() }, 404);
  }
  if (
    code === "MEMBERSHIP_ACTOR_USER_ID_REQUIRED" ||
    code === "MEMBERSHIP_TARGET_USER_ID_REQUIRED" ||
    code === "MEMBERSHIP_ORGANIZATION_ID_REQUIRED" ||
    code === "MEMBERSHIP_TIMESTAMP_INVALID" ||
    code === "MEMBERSHIP_ROLE_INVALID" ||
    code === "MEMBERSHIP_STATUS_INVALID"
  ) return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  return jsonResponse({ ok: false, error: "internal_error" }, 500);
}

export async function handleMembershipMutation(
  request: Request,
  dependencies: PlatformApiDependencies,
): Promise<Response> {
  if (request.method !== "PUT") {
    return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: "PUT" });
  }
  if (!sameOriginMutation(request)) return jsonResponse({ ok: false, error: "same_origin_required" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, error: "json_required" }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const input = parseInput(payload);
  if (!input) return jsonResponse({ ok: false, error: "invalid_request" }, 400);

  const token = (await dependencies.accessTokens.getAccessToken(request))?.trim();
  if (!token) return jsonResponse({ ok: false, error: "authentication_required" }, 401);
  const now = dependencies.clock.now();
  const context = await dependencies.services.resolveSessionContext({ accessToken: token, now });
  if (context.session.status !== "authenticated") {
    return jsonResponse({ ok: false, error: "authentication_required" }, 401);
  }
  if (!dependencies.services.manageMembership) {
    return jsonResponse({ ok: false, error: "membership_management_unavailable" }, 503);
  }

  try {
    const membership = await dependencies.services.manageMembership({
      actorUserId: context.session.userId,
      targetUserId: input.targetUserId,
      organizationId: input.organizationId,
      role: input.role,
      status: input.status,
      now,
    });
    return jsonResponse({ ok: true, membership: publicMembership(membership) });
  } catch (error) {
    return membershipError(error);
  }
}
