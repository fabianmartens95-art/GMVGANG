import type { IncomingMessage, ServerResponse } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCreator, type PublicCreatorRegistrationInput } from "@gmvgang/creator-registration";
import type { PlatformSessionContext } from "@gmvgang/platform-foundation";
import {
  createPlatformAdminClient,
  createSupabaseCreatorRegistrationPorts,
  ensureCreatorPortalMembership,
  resolveSupabasePlatformSessionContext,
} from "@gmvgang/platform-supabase";
import { createRequestSupabaseClient, requestAccessToken } from "./supabase-request.js";

export type PlatformApiConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  privacyNoticeVersion: string;
};

export type PlatformApiDependencies = {
  adminClient?: SupabaseClient;
  createRequestClient?: typeof createRequestSupabaseClient;
  now?: () => string;
};

const MAX_JSON_BYTES = 32 * 1024;

function required(value: string, code: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.setHeader("Cache-Control", "no-store");
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BYTES) throw new Error("REQUEST_BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("REQUEST_JSON_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCreatorRegistrationPayload(payload: unknown): PublicCreatorRegistrationInput {
  if (!isRecord(payload)) throw new Error("REGISTRATION_PAYLOAD_INVALID");
  if (
    typeof payload.tiktokHandle !== "string" ||
    typeof payload.ageConfirmed !== "boolean" ||
    typeof payload.privacyAccepted !== "boolean" ||
    typeof payload.privacyNoticeVersion !== "string"
  ) {
    throw new Error("REGISTRATION_PAYLOAD_INVALID");
  }

  const result: PublicCreatorRegistrationInput = {
    tiktokHandle: payload.tiktokHandle,
    ageConfirmed: payload.ageConfirmed,
    privacyAccepted: payload.privacyAccepted,
    privacyNoticeVersion: payload.privacyNoticeVersion,
  };

  if (payload.displayName !== undefined) {
    if (typeof payload.displayName !== "string") throw new Error("REGISTRATION_PAYLOAD_INVALID");
    result.displayName = payload.displayName;
  }
  if (payload.market !== undefined) {
    if (typeof payload.market !== "string") throw new Error("REGISTRATION_PAYLOAD_INVALID");
    result.market = payload.market;
  }
  if (payload.language !== undefined) {
    if (typeof payload.language !== "string") throw new Error("REGISTRATION_PAYLOAD_INVALID");
    result.language = payload.language;
  }
  if (payload.niche !== undefined) {
    if (!Array.isArray(payload.niche) || !payload.niche.every((value) => typeof value === "string")) {
      throw new Error("REGISTRATION_PAYLOAD_INVALID");
    }
    result.niche = payload.niche;
  }
  if (payload.referralCode !== undefined) {
    if (typeof payload.referralCode !== "string") throw new Error("REGISTRATION_PAYLOAD_INVALID");
    result.referralCode = payload.referralCode;
  }

  return result;
}

function publicRegistrationResult(result: Awaited<ReturnType<typeof registerCreator>>): unknown {
  if (!result.ok) return result;
  return {
    ok: true,
    created: result.created,
    creatorProfile: {
      id: result.creatorProfile.id,
      tiktokHandle: result.creatorProfile.tiktokHandle,
      networkStatus: result.creatorProfile.networkStatus,
      profileCompletionPercent: result.creatorProfile.profileCompletionPercent,
      referralCode: result.creatorProfile.referralCode,
    },
    referral: result.referral,
  };
}

function requestedOrganizationId(request: IncomingMessage): string | undefined {
  const value = request.headers["x-gmvgang-organization-id"];
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

function authFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    "SESSION_EMAIL_NOT_VERIFIED",
    "SESSION_EXPIRED",
    "ACCOUNT_ACCESS_DENIED",
    "ORGANIZATION_ACCESS_DENIED",
  ].includes(error.message);
}

export function createPlatformApi(config: PlatformApiConfig, dependencies: PlatformApiDependencies = {}) {
  const supabaseUrl = required(config.supabaseUrl, "SUPABASE_URL_REQUIRED");
  const supabasePublishableKey = required(config.supabasePublishableKey, "SUPABASE_PUBLISHABLE_KEY_REQUIRED");
  const privacyNoticeVersion = required(config.privacyNoticeVersion, "CREATOR_PRIVACY_NOTICE_VERSION_REQUIRED");
  const adminClient = dependencies.adminClient ?? createPlatformAdminClient({
    url: supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  });
  const requestClientFactory = dependencies.createRequestClient ?? createRequestSupabaseClient;
  const now = dependencies.now ?? (() => new Date().toISOString());

  async function sessionContext(
    request: IncomingMessage,
    response: ServerResponse,
    useRequestedWorkspace: boolean,
  ): Promise<PlatformSessionContext | null> {
    const requestClient = requestClientFactory(request, response, {
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
    });
    const accessToken = await requestAccessToken(requestClient);
    if (!accessToken) return null;

    const organizationId = useRequestedWorkspace ? requestedOrganizationId(request) : undefined;
    return resolveSupabasePlatformSessionContext(adminClient, {
      accessToken,
      ...(organizationId ? { requestedOrganizationId: organizationId } : {}),
      now: now(),
    });
  }

  return async function handlePlatformApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? "/", "http://platform.local");

    if (url.pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, { ok: true, service: "gmvgang-platform" });
      return true;
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      try {
        const context = await sessionContext(request, response, true);
        sendJson(response, 200, context?.session ?? { status: "anonymous", roles: [] });
      } catch (error) {
        if (authFailure(error)) {
          sendJson(response, 401, { status: "anonymous", roles: [] });
        } else {
          console.error("platform_session_failed", error);
          sendJson(response, 503, { status: "anonymous", roles: [] });
        }
      }
      return true;
    }

    if (url.pathname === "/api/workspaces" && request.method === "GET") {
      try {
        const context = await sessionContext(request, response, false);
        if (!context || context.session.status !== "authenticated") {
          sendJson(response, 401, []);
          return true;
        }
        sendJson(response, 200, context.workspaces);
      } catch (error) {
        if (authFailure(error)) sendJson(response, 401, []);
        else {
          console.error("platform_workspaces_failed", error);
          sendJson(response, 503, []);
        }
      }
      return true;
    }

    if (url.pathname === "/api/creator/registration" && request.method === "POST") {
      try {
        const context = await sessionContext(request, response, false);
        if (!context || context.session.status !== "authenticated") {
          sendJson(response, 401, { ok: false, errors: ["authentication_required"] });
          return true;
        }

        const input = parseCreatorRegistrationPayload(await readJson(request));
        if (input.privacyNoticeVersion.trim() !== privacyNoticeVersion) {
          sendJson(response, 409, { ok: false, errors: ["privacy_notice_version_stale"] });
          return true;
        }

        const result = await registerCreator(
          input,
          { userId: context.session.userId, now: now() },
          createSupabaseCreatorRegistrationPorts(adminClient),
        );

        if (!result.ok) {
          sendJson(response, 400, result);
          return true;
        }

        await ensureCreatorPortalMembership(adminClient, context.session.userId);
        sendJson(response, result.created ? 201 : 200, publicRegistrationResult(result));
      } catch (error) {
        if (error instanceof Error && error.message === "CREATOR_MEMBERSHIP_REVOKED") {
          sendJson(response, 403, { ok: false, errors: ["creator_portal_access_revoked"] });
          return true;
        }
        if (
          error instanceof Error &&
          ["REQUEST_BODY_TOO_LARGE", "REQUEST_JSON_INVALID", "REGISTRATION_PAYLOAD_INVALID"].includes(error.message)
        ) {
          sendJson(response, 400, { ok: false, errors: [error.message.toLowerCase()] });
          return true;
        }
        if (authFailure(error)) {
          sendJson(response, 401, { ok: false, errors: ["authentication_required"] });
          return true;
        }
        console.error("creator_registration_failed", error);
        sendJson(response, 503, { ok: false, errors: ["registration_unavailable"] });
      }
      return true;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "not_found" });
      return true;
    }

    return false;
  };
}
