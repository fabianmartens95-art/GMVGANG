import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { createPlatformApiHandler, createSupabasePlatformApiServices } from "@gmvgang/platform-api";
import { createClient } from "@supabase/supabase-js";

import {
  createPlatformAuditLogger,
  recordAuditBestEffort,
  type PlatformAuditLogger,
} from "./audit.js";
import {
  applyResponseMutations,
  createCookieAccessTokenPort,
  createRequestSupabaseClient,
  type ResponseMutations,
} from "./auth.js";
import { loadPlatformServerConfig, type PlatformServerConfig } from "./env.js";
import {
  createSupabaseIdempotencyClient,
  SupabasePlatformIdempotencyPort,
} from "./idempotency.js";
import { NotionCreatorOperationsSync } from "./notion-creator-sync.js";
import { NotionCreatorWorkspaceReadPort } from "./notion-creator-workspace.js";
import {
  createFixedWindowRateLimiter,
  createPlatformMutationRateLimitPort,
  type FixedWindowRateLimiter,
} from "./rate-limit.js";
import { handleParallelV1 } from "./parallel-v1.js";
import { handleTikTokCreatorIntegration } from "./tiktok.js";
import { requestIdFromHeader, requestLogEntry, withRequestId } from "./request-context.js";

const MAX_REQUEST_BYTES = 1024 * 1024;
const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin";
}

function validEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const cleaned = value.trim();
  return cleaned.length >= 5 && cleaned.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}


const COMMON_EMAIL_DOMAIN_TYPO_SUGGESTIONS: Readonly<Record<string, string>> = Object.freeze({
  "gmail.vom": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.con": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "googlemail.vom": "googlemail.com",
  "googlemail.cmo": "googlemail.com",
  "googlemail.con": "googlemail.com",
  "outlook.vom": "outlook.com",
  "outlook.cmo": "outlook.com",
  "outlook.con": "outlook.com",
  "hotmail.vom": "hotmail.com",
  "hotmail.cmo": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "icloud.vom": "icloud.com",
  "icloud.cmo": "icloud.com",
  "icloud.con": "icloud.com",
  "yahoo.vom": "yahoo.com",
  "yahoo.cmo": "yahoo.com",
  "yahoo.con": "yahoo.com",
});

export function emailDomainSuggestion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase();
  const separator = cleaned.lastIndexOf("@");
  if (separator <= 0 || separator === cleaned.length - 1) return null;

  const domain = cleaned.slice(separator + 1);
  const knownSuggestion = COMMON_EMAIL_DOMAIN_TYPO_SUGGESTIONS[domain];
  if (knownSuggestion) return knownSuggestion;

  if (domain.endsWith(".vom") && domain.length > 4) {
    return `${domain.slice(0, -4)}.com`;
  }

  return null;
}

function validLoginPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128;
}

function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function auditNow(): string {
  return new Date().toISOString();
}

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const cleaned = value.trim();
  if (
    !cleaned.startsWith("/") ||
    cleaned.startsWith("//") ||
    cleaned.includes("\\") ||
    cleaned.length > 512
  ) {
    return "/";
  }
  try {
    const parsed = new URL(cleaned, "https://gmvgang.local");
    if (parsed.origin !== "https://gmvgang.local") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function safeConfirmationNextPath(value: unknown, publicOrigin: string): string {
  if (typeof value !== "string") return "/";
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 1024) return "/";

  try {
    const origin = new URL(publicOrigin).origin;
    const parsed = new URL(cleaned, origin);
    if (parsed.origin !== origin) return "/";

    if (parsed.pathname === "/auth/callback") {
      return safeNextPath(parsed.searchParams.get("next"));
    }

    return safeNextPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return "/";
  }
}

async function authResponse(
  request: Request,
  client: ReturnType<typeof createRequestSupabaseClient>,
  config: PlatformServerConfig,
  signInRateLimit: FixedWindowRateLimiter,
  audit: PlatformAuditLogger,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/sign-in") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "json_required" }, 415);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
    if (!record || !validEmail(record.email)) return json({ ok: false, error: "invalid_email" }, 400);

    const email = record.email.trim().toLowerCase();
    const authMethod = record.password !== undefined ? "password" : "magic_link";
    const suggestedDomain = emailDomainSuggestion(email);
    if (suggestedDomain) {
      await recordAuditBestEffort(audit, {
        event: "auth.email.rejected_typo",
        occurredAt: auditNow(),
        requestId,
        metadata: { authMethod, suggestedDomain },
      });
      return json({ ok: false, error: "email_domain_typo", suggestion: suggestedDomain }, 400);
    }
    if (!signInRateLimit.consume(email)) {
      await recordAuditBestEffort(audit, {
        event: "auth.sign_in.rate_limited",
        occurredAt: auditNow(),
        requestId,
        metadata: { authMethod },
      });
      return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": "900" });
    }

    if (record.password !== undefined) {
      if (!validLoginPassword(record.password)) {
        await recordAuditBestEffort(audit, {
          event: "auth.password.sign_in_failed",
          occurredAt: auditNow(),
          requestId,
          metadata: { reason: "invalid_credentials" },
        });
        return json({ ok: false, error: "invalid_credentials" }, 401);
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password: record.password });
      if (error) {
        await recordAuditBestEffort(audit, {
          event: "auth.password.sign_in_failed",
          occurredAt: auditNow(),
          requestId,
          metadata: { reason: "invalid_credentials" },
        });
        return json({ ok: false, error: "invalid_credentials" }, 401);
      }
      await recordAuditBestEffort(audit, {
        event: "auth.password.signed_in",
        userId: data.user?.id ?? null,
        occurredAt: auditNow(),
        requestId,
        metadata: { authMethod: "password" },
      });
      return json({ ok: true });
    }

    const next = safeNextPath(record.next);
    const redirectUrl = new URL("/auth/callback", config.publicOrigin);
    redirectUrl.searchParams.set("next", next);

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      await recordAuditBestEffort(audit, {
        event: "auth.magic_link.request_failed",
        occurredAt: auditNow(),
        requestId,
      });
      return json({ ok: false, error: "sign_in_unavailable" }, 503);
    }
    await recordAuditBestEffort(audit, {
      event: "auth.magic_link.requested",
      occurredAt: auditNow(),
      requestId,
      metadata: { next },
    });
    return json({ ok: true }, 202);
  }

  if (url.pathname === "/api/auth/password") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "json_required" }, 415);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
    if (!record || !validNewPassword(record.password)) {
      return json({ ok: false, error: "weak_password" }, 400);
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: "authentication_required" }, 401);
    }

    const { error } = await client.auth.updateUser({ password: record.password });
    if (error) return json({ ok: false, error: "password_update_failed" }, 400);
    await recordAuditBestEffort(audit, {
      event: "auth.password.updated",
      userId: userData.user.id,
      occurredAt: auditNow(),
      requestId,
    });
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/sign-out") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
    const { data: userData } = await client.auth.getUser();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return json({ ok: false, error: "sign_out_unavailable" }, 503);
    await recordAuditBestEffort(audit, {
      event: "auth.signed_out",
      userId: userData.user?.id ?? null,
      occurredAt: auditNow(),
      requestId,
    });
    return json({ ok: true });
  }

  if (url.pathname === "/auth/confirm") {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    const tokenHash = url.searchParams.get("token_hash")?.trim();
    const type = url.searchParams.get("type")?.trim();
    if (!tokenHash || tokenHash.length > 2048 || type !== "email") {
      return Response.redirect(new URL("/login?error=missing_token", config.publicOrigin), 303);
    }

    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error) {
      await recordAuditBestEffort(audit, {
        event: "auth.magic_link.sign_in_failed",
        occurredAt: auditNow(),
        requestId,
      });
      return Response.redirect(new URL("/login?error=auth_callback", config.publicOrigin), 303);
    }

    await recordAuditBestEffort(audit, {
      event: "auth.magic_link.signed_in",
      userId: data.user?.id ?? null,
      occurredAt: auditNow(),
      requestId,
      metadata: { authMethod: "magic_link" },
    });
    const next = safeConfirmationNextPath(url.searchParams.get("next"), config.publicOrigin);
    return Response.redirect(new URL(next, config.publicOrigin), 303);
  }

  if (url.pathname === "/auth/callback") {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const code = url.searchParams.get("code")?.trim();
    if (!code) return Response.redirect(new URL("/login?error=missing_code", config.publicOrigin), 303);

    const flowId = url.searchParams.get("sb_flow_id")?.trim();
    const { data, error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) {
      await recordAuditBestEffort(audit, {
        event: "auth.pkce.sign_in_failed",
        occurredAt: auditNow(),
        requestId,
      });
      return Response.redirect(new URL("/login?error=auth_callback", config.publicOrigin), 303);
    }
    await recordAuditBestEffort(audit, {
      event: "auth.pkce.signed_in",
      userId: data.user?.id ?? null,
      occurredAt: auditNow(),
      requestId,
      metadata: { authMethod: "pkce" },
    });
    return Response.redirect(new URL(safeNextPath(url.searchParams.get("next")), config.publicOrigin), 303);
  }

  return null;
}

async function readRequestBody(request: IncomingMessage): Promise<string | undefined> {
  const method = request.method ?? "GET";
  if (method === "GET" || method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function webHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(request.headers)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) raw.forEach((value) => headers.append(key, value));
    else headers.set(key, raw);
  }
  return headers;
}

async function webRequest(request: IncomingMessage, config: PlatformServerConfig): Promise<Request> {
  const url = new URL(request.url ?? "/", config.publicOrigin);
  const body = await readRequestBody(request);
  return new Request(url, {
    method: request.method ?? "GET",
    headers: webHeaders(request),
    ...(body !== undefined ? { body } : {}),
  });
}

function insideDist(distRoot: string, candidate: string): boolean {
  return candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`);
}

async function staticResponse(request: Request, config: PlatformServerConfig): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "not_found" }, 404);
  const url = new URL(request.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return json({ error: "not_found" }, 404);
  }

  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = resolve(config.portalDistDir, requested);
  const root = resolve(config.portalDistDir);
  if (!insideDist(root, candidate)) return json({ error: "not_found" }, 404);

  let filePath = candidate;
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("NOT_FILE");
  } catch {
    filePath = resolve(root, "index.html");
  }

  try {
    const body = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    const isHashedAsset = url.pathname.startsWith("/assets/");
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Content-Type": MIME[extension] ?? "application/octet-stream",
        "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "portal_build_missing" }, 503);
  }
}

function setCookieHeaders(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (extended.getSetCookie) return extended.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

async function writeNodeResponse(response: Response, target: ServerResponse): Promise<void> {
  target.statusCode = response.status;
  target.statusMessage = response.statusText || target.statusMessage;
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    target.setHeader(key, value);
  }
  const cookies = setCookieHeaders(response.headers);
  if (cookies.length) target.setHeader("Set-Cookie", cookies);
  if (!response.body) {
    target.end();
    return;
  }
  target.end(Buffer.from(await response.arrayBuffer()));
}

export function createPlatformServer(config: PlatformServerConfig) {
  const creatorOperationsSync = config.notionCreatorSync
    ? new NotionCreatorOperationsSync(config.notionCreatorSync)
    : undefined;
  const creatorWorkspace = config.notionCreatorWorkspace
    ? new NotionCreatorWorkspaceReadPort(config.notionCreatorWorkspace)
    : undefined;
  const services = createSupabasePlatformApiServices(
    {
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    },
    {
      ...(creatorOperationsSync ? { creatorOperationsSync } : {}),
      ...(creatorWorkspace ? { creatorWorkspace } : {}),
      ...(config.affiliatePerformanceRead
        ? { affiliatePerformancePolicy: config.affiliatePerformanceRead }
        : {}),
    },
  );
  const audit = createPlatformAuditLogger({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  });
  const parallelAdminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const idempotency = new SupabasePlatformIdempotencyPort(createSupabaseIdempotencyClient({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  }));
  const mutationRateLimits = createPlatformMutationRateLimitPort();
  const signInRateLimit = createFixedWindowRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

  return createServer(async (incoming, outgoing) => {
    const startedAt = Date.now();
    const requestId = requestIdFromHeader(incoming.headers["x-request-id"]);
    const path = (incoming.url ?? "/").split("?", 1)[0] || "/";
    outgoing.setHeader("X-Request-Id", requestId);
    outgoing.once("finish", () => {
      console.log(JSON.stringify(requestLogEntry({
        requestId,
        method: incoming.method ?? "GET",
        path,
        status: outgoing.statusCode,
        durationMs: Date.now() - startedAt,
      })));
    });

    try {
      let request = await webRequest(incoming, config);
      request = withRequestId(request, requestId);
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        await writeNodeResponse(json({
          ok: true,
          service: "gmvgang-platform",
          revision: config.deploymentRevision,
          creatorOperationsSync: creatorOperationsSync ? "configured" : "not_configured",
          creatorWorkspaceRead: creatorWorkspace ? "configured" : "not_configured",
          affiliatePerformanceRead: config.affiliatePerformanceRead ? "configured" : "disabled",
          requestId,
        }), outgoing);
        return;
      }

      const mutations: ResponseMutations = { headers: new Headers(), setCookies: [] };
      const authClient = createRequestSupabaseClient(request, mutations, {
        supabaseUrl: config.supabaseUrl,
        supabasePublishableKey: config.supabasePublishableKey,
        production: config.production,
      });

      const auth = await authResponse(request, authClient, config, signInRateLimit, audit, requestId);
      if (auth) {
        await writeNodeResponse(applyResponseMutations(auth, mutations), outgoing);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        const tiktokIntegration = await handleTikTokCreatorIntegration(request, {
          requestClient: authClient,
          adminClient: parallelAdminClient,
          config,
          now: new Date().toISOString(),
          requestId,
        });
        if (tiktokIntegration) {
          await writeNodeResponse(applyResponseMutations(tiktokIntegration, mutations), outgoing);
          return;
        }

        const parallelV1 = await handleParallelV1(request, {
          requestClient: authClient,
          adminClient: parallelAdminClient,
          now: new Date().toISOString(),
          requestId,
          tiktokConfigured: Boolean(config.tiktokCreatorOAuth),
        });
        if (parallelV1) {
          await writeNodeResponse(applyResponseMutations(parallelV1, mutations), outgoing);
          return;
        }

        const handler = createPlatformApiHandler({
          accessTokens: createCookieAccessTokenPort(authClient),
          services,
          clock: { now: () => new Date().toISOString() },
          privacyNoticeVersion: config.privacyNoticeVersion,
          rateLimits: mutationRateLimits,
          idempotency,
        });
        const response = await handler(request);
        await writeNodeResponse(applyResponseMutations(response, mutations), outgoing);
        return;
      }

      await writeNodeResponse(await staticResponse(request, config), outgoing);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status = code === "REQUEST_TOO_LARGE" ? 413 : 500;
      await writeNodeResponse(json({
        error: status === 413 ? "request_too_large" : "internal_error",
        requestId,
      }, status), outgoing);
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  const config = loadPlatformServerConfig();
  createPlatformServer(config).listen(config.port, "0.0.0.0", () => {
    console.log(`GMVGANG platform listening on ${config.publicOrigin} (port ${config.port})`);
  });
}
