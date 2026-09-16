import type {
  CreatorProfileCompletionCommand,
  PublicCreatorRegistrationInput,
} from "@gmvgang/creator-registration";
import { anyRoleHasCapability, type CreatorProfile } from "@gmvgang/platform-foundation";
import { handleCreatorReferralHub } from "./creator-referral-http.js";
import { handleCreatorWorkspace } from "./creator-workspace-http.js";
import type { PlatformApiDependencies, PlatformRateLimitAction } from "./types.js";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,128}$/;

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
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
  ) return null;

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
  ) return null;
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

async function mutationAllowed(
  dependencies: PlatformApiDependencies,
  action: PlatformRateLimitAction,
  subject: string,
  now: string,
): Promise<boolean> {
  if (!dependencies.rateLimits) return true;
  return dependencies.rateLimits.consume({ action, subject, now });
}

async function requestHash(action: PlatformRateLimitAction, input: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(`${action}:${JSON.stringify(input)}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function idempotencyStart(
  request: Request,
  dependencies: PlatformApiDependencies,
  action: PlatformRateLimitAction,
  subject: string,
  input: unknown,
  now: string,
): Promise<
  | { status: "started"; key: string; requestHash: string }
  | { status: "response"; response: Response }
> {
  if (!dependencies.idempotency) {
    return { status: "response", response: jsonResponse({ ok: false, errors: ["idempotency_unavailable"] }, 503) };
  }

  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!key) {
    return { status: "response", response: jsonResponse({ ok: false, errors: ["idempotency_key_required"] }, 400) };
  }
  if (!IDEMPOTENCY_KEY.test(key)) {
    return { status: "response", response: jsonResponse({ ok: false, errors: ["idempotency_key_invalid"] }, 400) };
  }

  const fingerprint = await requestHash(action, input);
  const result = await dependencies.idempotency.begin({
    scope: action,
    subject,
    key,
    requestHash: fingerprint,
    now,
  });

  if (result.status === "replay") {
    return {
      status: "response",
      response: jsonResponse(result.responseBody, result.responseStatus, { "Idempotency-Replayed": "true" }),
    };
  }
  if (result.status === "conflict") {
    return { status: "response", response: jsonResponse({ ok: false, errors: ["idempotency_key_conflict"] }, 409) };
  }
  if (result.status === "in_progress") {
    return {
      status: "response",
      response: jsonResponse({ ok: false, errors: ["idempotency_in_progress"] }, 409, { "Retry-After": "2" }),
    };
  }
  return { status: "started", key, requestHash: fingerprint };
}

async function idempotencyComplete(
  dependencies: PlatformApiDependencies,
  action: PlatformRateLimitAction,
  subject: string,
  started: { key: string; requestHash: string },
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  if (!dependencies.idempotency) throw new Error("IDEMPOTENCY_UNAVAILABLE");
  await dependencies.idempotency.complete({
    scope: action,
    subject,
    key: started.key,
    requestHash: started.requestHash,
    responseStatus,
    responseBody,
    now: dependencies.clock.now(),
  });
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
  const context = await dependencies.services.resolveSessionContext({ accessToken: token, now: dependencies.clock.now() });
  return jsonResponse(context.session.status === "authenticated" ? context.workspaces : []);
}

async function handleBrandOverview(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const token = await accessToken(request, dependencies);
  if (!token) return jsonResponse({ error: "authentication_required" }, 401);

  const selectedOrganizationId = requestedOrganizationId(request);
  const now = dependencies.clock.now();
  const context = await dependencies.services.resolveSessionContext({
    accessToken: token,
    ...(selectedOrganizationId ? { requestedOrganizationId: selectedOrganizationId } : {}),
    now,
  });
  if (context.session.status !== "authenticated") return jsonResponse({ error: "authentication_required" }, 401);

  const organizationId = context.session.organizationId;
  if (!organizationId) return jsonResponse({ error: "organization_required" }, 400);
  const workspace = context.workspaces.find((candidate) => candidate.organizationId === organizationId);
  if (!workspace || workspace.organizationType !== "brand") return jsonResponse({ error: "brand_access_denied" }, 403);
  if (!anyRoleHasCapability(context.session.roles, "brand.portal.access")) {
    return jsonResponse({ error: "brand_access_denied" }, 403);
  }
  if (!dependencies.services.getBrandOverview) {
    return jsonResponse({ error: "brand_overview_unavailable" }, 503);
  }

  const model = await dependencies.services.getBrandOverview({
    organizationId,
    userId: context.session.userId,
    now,
  });
  if (model.organizationId !== organizationId) throw new Error("BRAND_OVERVIEW_TENANT_MISMATCH");
  return jsonResponse({ model, source: "production" });
}

async function handleCreatorRegistration(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (!sameOriginMutation(request)) return jsonResponse({ ok: false, errors: ["same_origin_required"] }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, errors: ["json_required"] }, 415);
  }
  const configuredPrivacyVersion = dependencies.privacyNoticeVersion.trim();
  if (!configuredPrivacyVersion) return jsonResponse({ ok: false, errors: ["registration_unavailable"] }, 503);

  let payload: unknown;
  try { payload = await request.json(); } catch { return jsonResponse({ ok: false, errors: ["invalid_json"] }, 400); }
  const input = parseCreatorRegistrationInput(payload);
  if (!input) return jsonResponse({ ok: false, errors: ["invalid_request"] }, 400);
  if (input.privacyNoticeVersion.trim() !== configuredPrivacyVersion) {
    return jsonResponse({ ok: false, errors: ["privacy_notice_version_outdated"] }, 409);
  }

  const trustedContext = await authenticatedCreatorContext(request, dependencies);
  if (!trustedContext) return jsonResponse({ ok: false, errors: ["authentication_required"] }, 401);
  if (!await mutationAllowed(dependencies, "creator_registration", trustedContext.userId, trustedContext.now)) {
    return jsonResponse({ ok: false, errors: ["rate_limited"] }, 429, { "Retry-After": "600" });
  }

  const idempotency = await idempotencyStart(
    request,
    dependencies,
    "creator_registration",
    trustedContext.userId,
    input,
    trustedContext.now,
  );
  if (idempotency.status === "response") return idempotency.response;

  const result = await dependencies.services.registerCreator(input, trustedContext);
  const responseBody = publicRegistrationResult(result);
  const responseStatus = result.ok ? 200 : 400;
  await idempotencyComplete(
    dependencies,
    "creator_registration",
    trustedContext.userId,
    idempotency,
    responseStatus,
    responseBody,
  );
  return jsonResponse(responseBody, responseStatus);
}

async function handleCreatorProfile(request: Request, dependencies: PlatformApiDependencies): Promise<Response> {
  if (request.method === "GET") {
    const trustedContext = await authenticatedCreatorContext(request, dependencies);
    if (!trustedContext) return jsonResponse({ ok: false, errors: ["authentication_required"] }, 401);
    const profile = await dependencies.services.getCreatorProfile(trustedContext);
    if (!profile) return jsonResponse({ ok: false, errors: ["creator_profile_not_found"] }, 404);
    return jsonResponse({ ok: true, creatorProfile: publicCreatorProfile(profile) });
  }

  if (request.method !== "POST") return methodNotAllowed(["GET", "POST"]);
  if (!sameOriginMutation(request)) return jsonResponse({ ok: false, errors: ["same_origin_required"] }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ ok: false, errors: ["json_required"] }, 415);
  }
  let payload: unknown;
  try { payload = await request.json(); } catch { return jsonResponse({ ok: false, errors: ["invalid_json"] }, 400); }
  const input = parseCreatorProfileCompletionInput(payload);
  if (!input) return jsonResponse({ ok: false, errors: ["invalid_request"] }, 400);

  const trustedContext = await authenticatedCreatorContext(request, dependencies);
  if (!trustedContext) return jsonResponse({ ok: false, errors: ["authentication_required"] }, 401);
  if (!await mutationAllowed(dependencies, "creator_profile_completion", trustedContext.userId, trustedContext.now)) {
    return jsonResponse({ ok: false, errors: ["rate_limited"] }, 429, { "Retry-After": "600" });
  }

  const idempotency = await idempotencyStart(
    request,
    dependencies,
    "creator_profile_completion",
    trustedContext.userId,
    input,
    trustedContext.now,
  );
  if (idempotency.status === "response") return idempotency.response;

  const profile = await dependencies.services.completeCreatorProfile(input, trustedContext);
  const responseBody = { ok: true, creatorProfile: publicCreatorProfile(profile) };
  await idempotencyComplete(
    dependencies,
    "creator_profile_completion",
    trustedContext.userId,
    idempotency,
    200,
    responseBody,
  );
  return jsonResponse(responseBody);
}

function publicError(error: unknown): Response {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  if (
    code === "SESSION_EMAIL_NOT_VERIFIED" || code === "SESSION_EXPIRED" || code === "ACCOUNT_ACCESS_DENIED" ||
    code === "ORGANIZATION_ACCESS_DENIED" || code === "SUPABASE_IDENTITY_MISMATCH" || code === "PLATFORM_USER_NOT_PROVISIONED"
  ) return jsonResponse({ error: "access_denied" }, 403);
  if (code === "CREATOR_PROFILE_NOT_FOUND") return jsonResponse({ ok: false, errors: ["creator_profile_not_found"] }, 404);
  if (code === "TIKTOK_HANDLE_ALREADY_REGISTERED") return jsonResponse({ ok: false, errors: ["tiktok_handle_already_registered"] }, 409);
  if (
    code === "INVALID_TIKTOK_HANDLE" || code === "DISPLAY_NAME_REQUIRED" || code === "MARKET_REQUIRED" ||
    code === "LANGUAGE_REQUIRED" || code === "NICHE_REQUIRED"
  ) return jsonResponse({ ok: false, errors: [code.toLowerCase()] }, 400);
  if (code === "ORGANIZATION_SELECTOR_INVALID") return jsonResponse({ error: "invalid_organization_selector" }, 400);
  return jsonResponse({ error: "internal_error" }, 500);
}

export function createPlatformApiHandler(dependencies: PlatformApiDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/session") return await handleSession(request, dependencies);
      if (pathname === "/api/workspaces") return await handleWorkspaces(request, dependencies);
      if (pathname === "/api/brand/overview") return await handleBrandOverview(request, dependencies);
      if (pathname === "/api/creator/registration") return await handleCreatorRegistration(request, dependencies);
      if (pathname === "/api/creator/profile") return await handleCreatorProfile(request, dependencies);
      if (pathname === "/api/creator/referrals") return await handleCreatorReferralHub(request, dependencies);
      if (pathname === "/api/creator/workspace") return await handleCreatorWorkspace(request, dependencies);
      return jsonResponse({ error: "not_found" }, 404);
    } catch (error) {
      return publicError(error);
    }
  };
}
