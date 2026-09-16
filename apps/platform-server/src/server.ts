import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { createPlatformApiHandler, createSupabasePlatformApiServices } from "@gmvgang/platform-api";

import {
  applyResponseMutations,
  createCookieAccessTokenPort,
  createRequestSupabaseClient,
  type ResponseMutations,
} from "./auth.js";
import { loadPlatformServerConfig, type PlatformServerConfig } from "./env.js";

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

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
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

async function authResponse(
  request: Request,
  client: ReturnType<typeof createRequestSupabaseClient>,
  config: PlatformServerConfig,
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

    const next = safeNextPath(record.next);
    const redirectUrl = new URL("/auth/callback", config.publicOrigin);
    redirectUrl.searchParams.set("next", next);

    const { error } = await client.auth.signInWithOtp({
      email: record.email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) return json({ ok: false, error: "sign_in_unavailable" }, 503);
    return json({ ok: true }, 202);
  }

  if (url.pathname === "/api/auth/sign-out") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return json({ ok: false, error: "sign_out_unavailable" }, 503);
    return json({ ok: true });
  }

  if (url.pathname === "/auth/callback") {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const code = url.searchParams.get("code")?.trim();
    if (!code) return Response.redirect(new URL("/login?error=missing_code", config.publicOrigin), 303);

    const flowId = url.searchParams.get("sb_flow_id")?.trim();
    const { error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) return Response.redirect(new URL("/login?error=auth_callback", config.publicOrigin), 303);
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
  const services = createSupabasePlatformApiServices({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  });

  return createServer(async (incoming, outgoing) => {
    try {
      const request = await webRequest(incoming, config);
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        await writeNodeResponse(json({ ok: true, service: "gmvgang-platform" }), outgoing);
        return;
      }

      const mutations: ResponseMutations = { headers: new Headers(), setCookies: [] };
      const authClient = createRequestSupabaseClient(request, mutations, {
        supabaseUrl: config.supabaseUrl,
        supabasePublishableKey: config.supabasePublishableKey,
        production: config.production,
      });

      const auth = await authResponse(request, authClient, config);
      if (auth) {
        await writeNodeResponse(applyResponseMutations(auth, mutations), outgoing);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        const handler = createPlatformApiHandler({
          accessTokens: createCookieAccessTokenPort(authClient),
          services,
          clock: { now: () => new Date().toISOString() },
          privacyNoticeVersion: config.privacyNoticeVersion,
        });
        const response = await handler(request);
        await writeNodeResponse(applyResponseMutations(response, mutations), outgoing);
        return;
      }

      await writeNodeResponse(await staticResponse(request, config), outgoing);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status = code === "REQUEST_TOO_LARGE" ? 413 : 500;
      await writeNodeResponse(json({ error: status === 413 ? "request_too_large" : "internal_error" }, status), outgoing);
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  const config = loadPlatformServerConfig();
  createPlatformServer(config).listen(config.port, "0.0.0.0", () => {
    console.log(`GMVGANG platform listening on ${config.publicOrigin} (port ${config.port})`);
  });
}
