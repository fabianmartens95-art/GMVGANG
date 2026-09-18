import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlatformServerConfig } from "./env.js";

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const STATE_COOKIE = "gmv_tiktok_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;
const ACCESS_REFRESH_SKEW_MS = 10 * 60 * 1000;

type TikTokConfig = NonNullable<PlatformServerConfig["tiktokCreatorOAuth"]>;

type TikTokDependencies = {
  requestClient: SupabaseClient;
  adminClient: SupabaseClient;
  config: PlatformServerConfig;
  requestId: string;
  now: string;
};

type CreatorIdentity = {
  userId: string;
  creatorProfileId: string;
};

type TikTokTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type TikTokUser = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
};

type StoredConnection = {
  creator_profile_id: string;
  tiktok_open_id: string;
  status: string;
  granted_scopes: string[];
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
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

function redirect(location: URL, cookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location.toString(),
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function portalRedirect(config: PlatformServerConfig, state: string): URL {
  const target = new URL("/creator/onboarding", config.publicOrigin);
  target.searchParams.set("tiktok", state);
  return target;
}

function safeErrorCode(error: unknown): string {
  return error instanceof Error ? (error.message.split(":", 1)[0] || "TIKTOK_INTEGRATION_FAILED") : "TIKTOK_INTEGRATION_FAILED";
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) return false;
  } catch {
    return false;
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

function stateCookie(value: string, config: PlatformServerConfig, maxAge = STATE_TTL_SECONDS): string {
  return serializeCookie(STATE_COOKIE, value, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: config.production,
  });
}

function clearStateCookie(config: PlatformServerConfig): string {
  return stateCookie("", config, 0);
}

function stateMatches(request: Request, provided: string | null): boolean {
  if (!provided) return false;
  const expected = parseCookie(request.headers.get("cookie") ?? "")[STATE_COOKIE];
  if (!expected) return false;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

function encryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY_INVALID");
  return key;
}

export function encryptTikTokToken(value: string, encodedKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTikTokToken(value: string, encodedKey: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error("TIKTOK_TOKEN_CIPHERTEXT_INVALID");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseScopes(raw: string): string[] {
  return [...new Set(raw.split(",").map((scope) => scope.trim()).filter(Boolean))].sort();
}

export function tiktokUserFieldsForScopes(scopes: readonly string[]): string[] {
  const granted = new Set(scopes);
  const fields = ["open_id", "union_id", "avatar_url", "display_name"];
  if (granted.has("user.info.profile")) {
    fields.push("username", "is_verified");
  }
  if (granted.has("user.info.stats")) {
    fields.push("follower_count", "following_count", "likes_count", "video_count");
  }
  return fields;
}

export function buildTikTokAuthorizeUrl(config: TikTokConfig, state: string): URL {
  const target = new URL(TIKTOK_AUTHORIZE_URL);
  target.searchParams.set("client_key", config.clientKey);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", config.scopes.join(","));
  target.searchParams.set("redirect_uri", config.redirectUri);
  target.searchParams.set("state", state);
  return target;
}

function expiry(now: string, seconds: number): string {
  const base = new Date(now);
  if (!Number.isFinite(seconds) || seconds <= 0 || Number.isNaN(base.valueOf())) {
    throw new Error("TIKTOK_TOKEN_RESPONSE_INVALID");
  }
  return new Date(base.valueOf() + seconds * 1000).toISOString();
}

function isTokenResponse(value: unknown): value is TikTokTokenResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === "string"
    && typeof record.refresh_token === "string"
    && typeof record.open_id === "string"
    && typeof record.scope === "string"
    && typeof record.token_type === "string"
    && typeof record.expires_in === "number"
    && typeof record.refresh_expires_in === "number"
  );
}

async function exchangeAuthorizationCode(code: string, config: TikTokConfig): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isTokenResponse(payload)) throw new Error("TIKTOK_TOKEN_EXCHANGE_FAILED");
  return payload;
}

async function refreshAccessToken(refreshToken: string, config: TikTokConfig): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isTokenResponse(payload)) throw new Error("TIKTOK_REFRESH_FAILED");
  return payload;
}

async function revokeAccessToken(accessToken: string, config: TikTokConfig): Promise<void> {
  const response = await fetch(TIKTOK_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      token: accessToken,
    }),
  });
  if (!response.ok) throw new Error("TIKTOK_REVOKE_FAILED");
}

async function fetchUserInfo(accessToken: string, scopes: readonly string[]): Promise<TikTokUser> {
  const target = new URL(TIKTOK_USER_INFO_URL);
  target.searchParams.set("fields", tiktokUserFieldsForScopes(scopes).join(","));
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("TIKTOK_PROFILE_SYNC_FAILED");
  }
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("TIKTOK_PROFILE_SYNC_FAILED");
  const user = (data as { user?: unknown }).user;
  if (typeof user !== "object" || user === null || Array.isArray(user)) throw new Error("TIKTOK_PROFILE_SYNC_FAILED");
  return user as TikTokUser;
}

async function creatorIdentity(deps: TikTokDependencies): Promise<CreatorIdentity> {
  const { data: userData, error: userError } = await deps.requestClient.auth.getUser();
  if (userError || !userData.user) throw new Error("AUTHENTICATION_REQUIRED");

  const { data: profile, error: profileError } = await deps.adminClient
    .from("creator_profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new Error("CREATOR_PROFILE_READ_FAILED");
  if (!profile) throw new Error("CREATOR_PROFILE_REQUIRED");

  return { userId: userData.user.id, creatorProfileId: profile.id };
}

function followerCompletion(
  followerCount: number | null,
  contentFormats: unknown,
  liveStatus: unknown,
): { percent: number; next: string } {
  const formats = Array.isArray(contentFormats) ? contentFormats : [];
  const checks = [
    typeof followerCount === "number" && followerCount >= 0,
    formats.length > 0,
    typeof liveStatus === "string" && liveStatus !== "unknown",
  ];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const next = percent >= 100
    ? "review_opportunities"
    : formats.length === 0
      ? "choose_content_formats"
      : "complete_creator_onboarding";
  return { percent, next };
}

async function writeActivity(
  deps: TikTokDependencies,
  identity: CreatorIdentity,
  eventType: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await deps.adminClient.from("workspace_activity_events").insert({
    actor_user_id: identity.userId,
    creator_profile_id: identity.creatorProfileId,
    event_type: eventType,
    entity_type: "creator_tiktok_connection",
    entity_id: identity.creatorProfileId,
    summary,
    metadata: { requestId: deps.requestId, ...metadata },
    occurred_at: deps.now,
  });
  if (error) console.error("GMVGANG_TIKTOK_ACTIVITY_WRITE_FAILED", { requestId: deps.requestId });
}

async function applyFollowerMetric(
  deps: TikTokDependencies,
  identity: CreatorIdentity,
  followerCount: number | undefined,
): Promise<void> {
  if (typeof followerCount !== "number" || !Number.isSafeInteger(followerCount) || followerCount < 0) return;

  const { data: onboarding, error: readError } = await deps.adminClient
    .from("creator_onboarding")
    .select("content_formats,live_status")
    .eq("creator_profile_id", identity.creatorProfileId)
    .maybeSingle();
  if (readError) throw new Error("CREATOR_ONBOARDING_READ_FAILED");

  const contentFormats = onboarding?.content_formats ?? [];
  const liveStatus = onboarding?.live_status ?? "unknown";
  const completion = followerCompletion(followerCount, contentFormats, liveStatus);

  const { error } = await deps.adminClient
    .from("creator_onboarding")
    .upsert({
      creator_profile_id: identity.creatorProfileId,
      follower_count: followerCount,
      follower_count_source: "tiktok",
      follower_count_verified_at: deps.now,
      content_formats: contentFormats,
      live_status: liveStatus,
      onboarding_status: completion.percent === 100 ? "complete" : "in_progress",
      onboarding_completion_percent: completion.percent,
      next_best_action: completion.next,
    }, { onConflict: "creator_profile_id" });
  if (error) throw new Error("CREATOR_ONBOARDING_WRITE_FAILED");
}

async function persistProfileSnapshot(
  deps: TikTokDependencies,
  identity: CreatorIdentity,
  config: TikTokConfig,
  token: TikTokTokenResponse | null,
  accessToken: string,
  scopes: string[],
  user: TikTokUser,
): Promise<void> {
  const openId = token?.open_id || user.open_id;
  if (!openId) throw new Error("TIKTOK_PROFILE_SYNC_FAILED");

  const { data: owner, error: ownerError } = await deps.adminClient
    .from("creator_tiktok_connections")
    .select("creator_profile_id")
    .eq("tiktok_open_id", openId)
    .maybeSingle();
  if (ownerError) throw new Error("TIKTOK_CONNECTION_READ_FAILED");
  if (owner && owner.creator_profile_id !== identity.creatorProfileId) {
    throw new Error("TIKTOK_ACCOUNT_ALREADY_CONNECTED");
  }

  const connection: Record<string, unknown> = {
    creator_profile_id: identity.creatorProfileId,
    tiktok_open_id: openId,
    union_id: user.union_id ?? null,
    username: user.username ?? null,
    display_name: user.display_name ?? null,
    avatar_url: user.avatar_url ?? null,
    is_verified: typeof user.is_verified === "boolean" ? user.is_verified : null,
    granted_scopes: scopes,
    status: "connected",
    follower_count: typeof user.follower_count === "number" ? user.follower_count : null,
    following_count: typeof user.following_count === "number" ? user.following_count : null,
    likes_count: typeof user.likes_count === "number" ? user.likes_count : null,
    video_count: typeof user.video_count === "number" ? user.video_count : null,
    last_synced_at: deps.now,
  };

  if (token) {
    connection.access_token_ciphertext = encryptTikTokToken(token.access_token, config.tokenEncryptionKey);
    connection.refresh_token_ciphertext = encryptTikTokToken(token.refresh_token, config.tokenEncryptionKey);
    connection.access_token_expires_at = expiry(deps.now, token.expires_in);
    connection.refresh_token_expires_at = expiry(deps.now, token.refresh_expires_in);
    connection.connected_at = deps.now;
  }

  const { error: connectionError } = await deps.adminClient
    .from("creator_tiktok_connections")
    .upsert(connection, { onConflict: "creator_profile_id" });
  if (connectionError) throw new Error("TIKTOK_CONNECTION_WRITE_FAILED");

  const { error: metricError } = await deps.adminClient.from("creator_tiktok_metrics").insert({
    creator_profile_id: identity.creatorProfileId,
    tiktok_open_id: openId,
    follower_count: typeof user.follower_count === "number" ? user.follower_count : null,
    following_count: typeof user.following_count === "number" ? user.following_count : null,
    likes_count: typeof user.likes_count === "number" ? user.likes_count : null,
    video_count: typeof user.video_count === "number" ? user.video_count : null,
    captured_at: deps.now,
  });
  if (metricError) throw new Error("TIKTOK_METRIC_WRITE_FAILED");

  await applyFollowerMetric(deps, identity, user.follower_count);
}

async function loadConnection(
  deps: TikTokDependencies,
  identity: CreatorIdentity,
): Promise<StoredConnection> {
  const { data, error } = await deps.adminClient
    .from("creator_tiktok_connections")
    .select("creator_profile_id,tiktok_open_id,status,granted_scopes,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,refresh_token_expires_at")
    .eq("creator_profile_id", identity.creatorProfileId)
    .maybeSingle();
  if (error) throw new Error("TIKTOK_CONNECTION_READ_FAILED");
  if (!data) throw new Error("TIKTOK_CONNECTION_REQUIRED");
  return data as StoredConnection;
}

async function usableAccessToken(
  deps: TikTokDependencies,
  connection: StoredConnection,
  config: TikTokConfig,
): Promise<{ accessToken: string; scopes: string[] }> {
  if (connection.status !== "connected") throw new Error("TIKTOK_REAUTHORIZATION_REQUIRED");
  if (!connection.access_token_ciphertext || !connection.refresh_token_ciphertext) {
    throw new Error("TIKTOK_REAUTHORIZATION_REQUIRED");
  }

  const expiryTime = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).valueOf() : 0;
  if (Number.isFinite(expiryTime) && expiryTime > Date.now() + ACCESS_REFRESH_SKEW_MS) {
    return {
      accessToken: decryptTikTokToken(connection.access_token_ciphertext, config.tokenEncryptionKey),
      scopes: connection.granted_scopes ?? [],
    };
  }

  let refreshed: TikTokTokenResponse;
  try {
    refreshed = await refreshAccessToken(
      decryptTikTokToken(connection.refresh_token_ciphertext, config.tokenEncryptionKey),
      config,
    );
  } catch {
    await deps.adminClient
      .from("creator_tiktok_connections")
      .update({ status: "reauthorization_required" })
      .eq("creator_profile_id", connection.creator_profile_id);
    throw new Error("TIKTOK_REAUTHORIZATION_REQUIRED");
  }

  const scopes = parseScopes(refreshed.scope);
  const { error } = await deps.adminClient
    .from("creator_tiktok_connections")
    .update({
      access_token_ciphertext: encryptTikTokToken(refreshed.access_token, config.tokenEncryptionKey),
      refresh_token_ciphertext: encryptTikTokToken(refreshed.refresh_token, config.tokenEncryptionKey),
      access_token_expires_at: expiry(deps.now, refreshed.expires_in),
      refresh_token_expires_at: expiry(deps.now, refreshed.refresh_expires_in),
      granted_scopes: scopes,
      status: "connected",
    })
    .eq("creator_profile_id", connection.creator_profile_id);
  if (error) throw new Error("TIKTOK_CONNECTION_WRITE_FAILED");

  return { accessToken: refreshed.access_token, scopes };
}

async function connect(request: Request, deps: TikTokDependencies, config: TikTokConfig): Promise<Response> {
  await creatorIdentity(deps);
  const state = randomBytes(32).toString("base64url");
  return redirect(buildTikTokAuthorizeUrl(config, state), stateCookie(state, deps.config));
}

async function callback(request: Request, deps: TikTokDependencies, config: TikTokConfig): Promise<Response> {
  const url = new URL(request.url);
  const clearCookie = clearStateCookie(deps.config);

  if (!stateMatches(request, url.searchParams.get("state"))) {
    return redirect(portalRedirect(deps.config, "state_error"), clearCookie);
  }
  if (url.searchParams.get("error")) {
    return redirect(portalRedirect(deps.config, "cancelled"), clearCookie);
  }

  const code = url.searchParams.get("code")?.trim();
  if (!code || code.length > 4096) {
    return redirect(portalRedirect(deps.config, "missing_code"), clearCookie);
  }

  try {
    const identity = await creatorIdentity(deps);
    const token = await exchangeAuthorizationCode(code, config);
    const scopes = parseScopes(token.scope);
    const user = await fetchUserInfo(token.access_token, scopes);
    await persistProfileSnapshot(deps, identity, config, token, token.access_token, scopes, user);
    await writeActivity(deps, identity, "creator.tiktok.connected", "TikTok-Konto verbunden", {
      scopes,
      username: user.username ?? null,
    });
    return redirect(portalRedirect(deps.config, "connected"), clearCookie);
  } catch (error) {
    const code = safeErrorCode(error);
    console.error("GMVGANG_TIKTOK_CALLBACK_FAILED", { code, requestId: deps.requestId });
    const state = code === "TIKTOK_ACCOUNT_ALREADY_CONNECTED" ? "already_connected" : "error";
    return redirect(portalRedirect(deps.config, state), clearCookie);
  }
}

async function sync(request: Request, deps: TikTokDependencies, config: TikTokConfig): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
  const identity = await creatorIdentity(deps);
  const connection = await loadConnection(deps, identity);
  const token = await usableAccessToken(deps, connection, config);
  const user = await fetchUserInfo(token.accessToken, token.scopes);
  await persistProfileSnapshot(deps, identity, config, null, token.accessToken, token.scopes, user);
  await writeActivity(deps, identity, "creator.tiktok.synced", "TikTok-Daten synchronisiert", {
    username: user.username ?? null,
  });
  return json({ ok: true, syncedAt: deps.now });
}

async function disconnect(request: Request, deps: TikTokDependencies, config: TikTokConfig): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, 403);
  const identity = await creatorIdentity(deps);
  const connection = await loadConnection(deps, identity);

  if (connection.access_token_ciphertext) {
    try {
      await revokeAccessToken(
        decryptTikTokToken(connection.access_token_ciphertext, config.tokenEncryptionKey),
        config,
      );
    } catch {
      console.warn("GMVGANG_TIKTOK_REVOKE_FAILED", { requestId: deps.requestId });
    }
  }

  const { error } = await deps.adminClient
    .from("creator_tiktok_connections")
    .update({
      status: "revoked",
      access_token_ciphertext: null,
      refresh_token_ciphertext: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
    })
    .eq("creator_profile_id", identity.creatorProfileId);
  if (error) throw new Error("TIKTOK_CONNECTION_WRITE_FAILED");

  await writeActivity(deps, identity, "creator.tiktok.disconnected", "TikTok-Konto getrennt");
  return json({ ok: true });
}

function apiError(error: unknown): Response {
  const code = safeErrorCode(error);
  if (code === "AUTHENTICATION_REQUIRED") return json({ ok: false, error: "authentication_required" }, 401);
  if (code === "CREATOR_PROFILE_REQUIRED") return json({ ok: false, error: "creator_profile_required" }, 400);
  if (code === "TIKTOK_CONNECTION_REQUIRED") return json({ ok: false, error: "tiktok_connection_required" }, 404);
  if (code === "TIKTOK_REAUTHORIZATION_REQUIRED") return json({ ok: false, error: "tiktok_reauthorization_required" }, 409);
  console.error("GMVGANG_TIKTOK_INTEGRATION_FAILED", { code });
  return json({ ok: false, error: "tiktok_integration_failed" }, 500);
}

export async function handleTikTokCreatorIntegration(
  request: Request,
  deps: TikTokDependencies,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const known = new Set([
    "/api/integrations/tiktok/connect",
    "/api/integrations/tiktok/callback",
    "/api/integrations/tiktok/sync",
    "/api/integrations/tiktok/disconnect",
  ]);
  if (!known.has(pathname)) return null;

  const config = deps.config.tiktokCreatorOAuth;
  if (!config) {
    if (pathname === "/api/integrations/tiktok/connect" || pathname === "/api/integrations/tiktok/callback") {
      return redirect(portalRedirect(deps.config, "not_configured"));
    }
    return json({ ok: false, error: "tiktok_integration_not_configured" }, 503);
  }

  try {
    if (pathname === "/api/integrations/tiktok/connect") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return await connect(request, deps, config);
    }
    if (pathname === "/api/integrations/tiktok/callback") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return await callback(request, deps, config);
    }
    if (pathname === "/api/integrations/tiktok/sync") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
      return await sync(request, deps, config);
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    return await disconnect(request, deps, config);
  } catch (error) {
    return apiError(error);
  }
}
