import type {
  CreatorProfileCompletionCommand,
  PublicCreatorRegistrationInput,
} from "@gmvgang/creator-registration";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import type { PlatformApiDependencies } from "./types.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function methodNotAllowed(allowed: readonly string[]): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405, { Allow: allowed.join(", ") });
}

function cleanAccessToken(value: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

function requestedOrganizationId(request: Request): string | undefined {
  const value = request.headers.get("X-GMVGANG-Organization-Id")?.trim();
  if (!value) return undefined;
  if (value.length > 128) throw new Error("ORGANIZATION_SELECTOR_INVALID");
  return value;
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

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function parseCreatorRegistrationInput(value: unknown): PublicCreatorRegistrationInput | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.tiktokHandle !== "string" ||
    typeof value.ageConfirmed !== "boolean" ||
    typeof value.privacyAccepted !== "boolean" ||
    typeof value.privacyNoticeVersion !== "string" ||
    !optionalString(value.displayName) ||
    !optionalString(value.market) ||
    !optionalString(value.language) ||
    !optionalString(value.referralCode) ||
    (value.niche !== undefined && (!Array.isArray(value.niche) || !value.niche.every((item) => typeof item === "string")))
  ) {
    return null;
  }

  const displayName = value.displayName?.trim();
  const market = value.market?.trim();
  const language = value.language?.trim();
  const referralCode = value.referralCode?.trim();
  const niche = Array.isArray(value.niche) ? value.niche.map((item) => String(item)) : undefined;

  return {
    tiktokHandle: value.tiktokHandle,
    ageConfirmed: value.ageConfirmed,
    privacyAccepted: value.privacyAccepted,
    privacyNoticeVersion: value.privacyNoticeVersion,
    ...(displayName ? { displayName } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(niche ? { niche } : {}),
    ...(referralCode ? { referralCode } : {}),
  };
}

function parseCreatorProfileCompletionInput(value: unknown): CreatorProfileCompletionCommand | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.tiktokHandle !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.market !== "string" ||
    typeof value.language !== "string" ||
    !Array.isArray(value.niche) ||
    !value.niche.every((item) => typeof item === "string")
  ) {
    return null;
  }

  return {
    tiktokHandle: value.tiktokHandle,
    displayName: value.displayName,
    market: value.market,
    language: value.language,
    niche: value.niche,
  };
}

function publicCreatorProfile(profile: CreatorProfile): unknown {
  return {
    id: profile.id,
    tiktokHandle: profile.tiktokHandle,
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    ...(profile.market ? { market: profile.market } : {}),
    ...(profile.language ? { language: profile.language } : {}),
    ...(profile.niche ? { niche: profile.niche } : {}),
    networkStatus: profile.networkStatus,
    profileCompletionPercent: profile.profileCompletionPercent,
    referralCode: profile.referralCode,
  };
}

function publicRegistrationResult(result: Awaited<ReturnType<PlatformApiDependencies["services"]["registerCreator"]>>): unknown {
  if (!result.ok) return result;
  return {
    ok: true,
    created: result.created,
    creatorProfile: publicCreatorProfile(result.creatorProfile),
    referral: result.referral,
  };
}

async function accessToken(request: Request, dependencies: PlatformApiDependencies): Promise<string | null> {
  return cleanAccessToken(await dependencies.accessTokens.getAccessToken(request));
}

async function authenticatedCreatorContext(request: Request, dependencies: PlatformApiDependencies) {
  const token = await accessToken(request, dependencies);
  if (!token) return null;

  const now = dependencies.clock.now();
  const context = await dependencies.services.resolveSessionContext({ accessToken: token, now });
  if (context.session.status !== "authenticated") return null;

  return { userId: context.session.userId, now };
}

async function handleSession(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const token = await accessToken(request, dependencies);
  if (!token) return jsonResponse({ status: "anonymous", roles: [] });

  const organizationId = requestedOrganizationId(request);
  const context = await dependencies.services.resolveSessionContext({
    accessToken: token,
    ...(organizationId ? { requestedOrganizationId: organizationId } : {}),
    now: dependencies.clock.now(),
  });
  return jsonResponse(context.session);
}

async function handleWorkspaces(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const token = await accessToken(request, dependencies);
  if (!token) return jsonResponse([]);

  const context = await dependencies.services.resolveSessionContext({
    accessToken: token,
    now: dependencies.clock.now(),
  });
  return jsonResponse(context.session.status === "authenticated" ? context.workspaces : []);
}

async function handleCreatorRegistration(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginMutation(request)) {
    return jsonResponse({ ok: false, errors: ["same_origin_required"] }, 403);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, errors: ["json_required"] }, 415);
  }

  const configuredPrivacyVersion = dependencies.privacyNoticeVersion.trim();
  if (!configuredPrivacyVersion) {
    return jsonResponse({ ok: false, errors: ["registration_unavailable"] }, 503);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, errors: ["invalid_json"] }, 400);
  }

  const input = parseCreatorRegistrationInput(payload);
  if (!input) {
    return jsonResponse({ ok: false, errors: ["invalid_request"] }, 400);
  }
  if (input.privacyNoticeVersion.trim() !== configuredPrivacyVersion) {
    return jsonResponse({ ok: false, errors: ["privacy_notice_version_outdated"] }, 409);
  }

  const trustedContext = await authenticatedCreatorContext(request, dependencies);
  if (!trustedContext) {
    return jsonResponse({ ok: false, errors: ["authentication_required"] }, 401);
  }

  const result = await dependencies.services.registerCreator(input, trustedContext);
  return jsonResponse(publicRegistrationResult(result), result.ok ? 200 : 400);
}

async function handleCreatorProfile(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginMutation(request)) {
    return jsonResponse({ ok: false, errors: ["same_origin_required"] }, 403);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, errors: ["json_required"] }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, errors: ["invalid_json"] }, 400);
  }

  const input = parseCreatorProfileCompletionInput(payload);
  if (!input) {
    return jsonResponse({ ok: false, errors: ["invalid_request"] }, 400);
  }

  const trustedContext = await authenticatedCreatorContext(request, dependencies);
  if (!trustedContext) {
    return jsonResponse({ ok: false, errors: ["authentication_required"] }, 401);
  }

  const profile = await dependencies.services.completeCreatorProfile(input, trustedContext);
  return jsonResponse({ ok: true, creatorProfile: publicCreatorProfile(profile) });
}

function publicError(error: unknown): Response {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  if (
    code === "SESSION_EMAIL_NOT_VERIFIED" ||
    code === "SESSION_EXPIRED" ||
    code === "ACCOUNT_ACCESS_DENIED" ||
    code === "ORGANIZATION_ACCESS_DENIED" ||
    code === "SUPABASE_IDENTITY_MISMATCH" ||
    code === "PLATFORM_USER_NOT_PROVISIONED"
  ) {
    return jsonResponse({ error: "access_denied" }, 403);
  }
  if (code === "CREATOR_PROFILE_NOT_FOUND") {
    return jsonResponse({ ok: false, errors: ["creator_profile_not_found"] }, 404);
  }
  if (code === "TIKTOK_HANDLE_ALREADY_REGISTERED") {
    return jsonResponse({ ok: false, errors: ["tiktok_handle_already_registered"] }, 409);
  }
  if (
    code === "INVALID_TIKTOK_HANDLE" ||
    code === "DISPLAY_NAME_REQUIRED" ||
    code === "MARKET_REQUIRED" ||
    code === "LANGUAGE_REQUIRED" ||
    code === "NICHE_REQUIRED"
  ) {
    return jsonResponse({ ok: false, errors: [code.toLowerCase()] }, 400);
  }
  if (code === "ORGANIZATION_SELECTOR_INVALID") {
    return jsonResponse({ error: "invalid_organization_selector" }, 400);
  }
  return jsonResponse({ error: "internal_error" }, 500);
}

export function createPlatformApiHandler(dependencies: PlatformApiDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/session") return await handleSession(request, dependencies);
      if (pathname === "/api/workspaces") return await handleWorkspaces(request, dependencies);
      if (pathname === "/api/creator/registration") return await handleCreatorRegistration(request, dependencies);
      if (pathname === "/api/creator/profile") return await handleCreatorProfile(request, dependencies);
      return jsonResponse({ error: "not_found" }, 404);
    } catch (error) {
      return publicError(error);
    }
  };
}
