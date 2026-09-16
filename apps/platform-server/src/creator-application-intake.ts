import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createFixedWindowRateLimiter } from "./rate-limit.js";

const FOLLOWER_BANDS = new Set(["0-1k", "1k-10k", "10k-50k", "50k-100k", "100k+"]);
const SHOP_EXPERIENCE = new Set(["none", "affiliate", "live", "affiliate_and_live"]);
const ACTIVE_APPLICATION_STATUSES = ["new", "screening", "detail_requested", "accepted"] as const;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;
const REFERRAL_PATTERN = /^[A-Z0-9]{6,24}$/;

export type CreatorApplicationIntakeConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  privacyNoticeVersion: string;
  allowedOrigins: readonly string[];
  makeWebhookUrl?: string | null;
  makeWebhookSecret?: string | null;
};

type CreatorApplicationPayload = {
  displayName: string;
  email: string;
  phone?: string;
  tiktokHandle: string;
  followerBand: string;
  contentCategories: string[];
  tiktokShopExperience: string;
  referralCode?: string;
  ageConfirmed: true;
  privacyAccepted: true;
  privacyNoticeVersion: string;
  company?: string;
};

type StoredApplication = {
  id: string;
  status: string;
  operations_sync_status: "pending" | "synced" | "failed";
};

type ApplicationRecord = {
  idempotency_key: string;
  display_name: string;
  email: string;
  phone: string | null;
  tiktok_handle: string;
  follower_band: string;
  content_categories: string[];
  tiktok_shop_experience: string;
  referral_code: string | null;
  source: "website";
  status: "new";
  age_confirmed: true;
  privacy_accepted: true;
  privacy_notice_version: string;
  operations_sync_status: "pending";
  submitted_at: string;
};

function json(payload: unknown, status: number, origin?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function originFor(request: Request, allowedOrigins: readonly string[]): string | null {
  const raw = request.headers.get("Origin")?.trim();
  if (!raw) return null;
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    return null;
  }
  return allowedOrigins.includes(origin) ? origin : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let candidate = value.trim();
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      const match = parsed.pathname.match(/^\/@([^/]+)/);
      if (!match) return null;
      candidate = match[1] ?? "";
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/^@/, "").trim().toLowerCase();
  if (!HANDLE_PATTERN.test(candidate) || candidate.startsWith(".") || candidate.endsWith(".")) return null;
  return candidate;
}

function cleanText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= minimum && cleaned.length <= maximum ? cleaned : null;
}

function cleanPhone(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (cleaned.length < 5 || cleaned.length > 32 || !/^[+0-9 ()/.-]+$/.test(cleaned)) return null;
  return cleaned;
}

function cleanCategories(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) return null;
  const cleaned = [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
  if (cleaned.length < 1 || cleaned.length > 5 || cleaned.some((item) => item.length > 40)) return null;
  return cleaned;
}

function cleanReferralCode(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return REFERRAL_PATTERN.test(code) ? code : null;
}

function parsePayload(value: unknown, privacyNoticeVersion: string): { ok: true; value: CreatorApplicationPayload } | { ok: false; errors: string[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, errors: ["invalid_request"] };
  const input = value as Record<string, unknown>;
  const errors: string[] = [];

  const displayName = cleanText(input.displayName, 2, 120);
  const email = normalizeEmail(input.email);
  const phone = cleanPhone(input.phone);
  const tiktokHandle = normalizeHandle(input.tiktokHandle);
  const followerBand = typeof input.followerBand === "string" && FOLLOWER_BANDS.has(input.followerBand) ? input.followerBand : null;
  const contentCategories = cleanCategories(input.contentCategories);
  const tiktokShopExperience = typeof input.tiktokShopExperience === "string" && SHOP_EXPERIENCE.has(input.tiktokShopExperience)
    ? input.tiktokShopExperience
    : null;
  const referralCode = cleanReferralCode(input.referralCode);

  if (!displayName) errors.push("invalid_display_name");
  if (!email) errors.push("invalid_email");
  if (phone === null) errors.push("invalid_phone");
  if (!tiktokHandle) errors.push("invalid_tiktok_handle");
  if (!followerBand) errors.push("invalid_follower_band");
  if (!contentCategories) errors.push("invalid_content_categories");
  if (!tiktokShopExperience) errors.push("invalid_tiktok_shop_experience");
  if (referralCode === null) errors.push("invalid_referral_code");
  if (input.ageConfirmed !== true) errors.push("age_confirmation_required");
  if (input.privacyAccepted !== true) errors.push("privacy_acceptance_required");
  if (input.privacyNoticeVersion !== privacyNoticeVersion) errors.push("privacy_notice_version_outdated");

  if (errors.length || !displayName || !email || phone === null || !tiktokHandle || !followerBand || !contentCategories || !tiktokShopExperience || referralCode === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      displayName,
      email,
      ...(phone ? { phone } : {}),
      tiktokHandle,
      followerBand,
      contentCategories,
      tiktokShopExperience,
      ...(referralCode ? { referralCode } : {}),
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion,
      ...(typeof input.company === "string" ? { company: input.company.trim() } : {}),
    },
  };
}

function clientIp(request: Request): string {
  const cloudflare = request.headers.get("CF-Connecting-IP")?.trim();
  if (cloudflare) return cloudflare.slice(0, 128);
  const forwarded = request.headers.get("X-Forwarded-For")?.split(",", 1)[0]?.trim();
  return (forwarded || "unknown").slice(0, 128);
}

async function findStored(
  client: SupabaseClient,
  idempotencyKey: string,
  tiktokHandle: string,
): Promise<StoredApplication | null> {
  const byKey = await client
    .from("creator_applications")
    .select("id,status,operations_sync_status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (byKey.error) throw new Error(`CREATOR_APPLICATION_LOOKUP_FAILED:${byKey.error.code ?? "unknown"}`);
  if (byKey.data) return byKey.data as StoredApplication;

  const byHandle = await client
    .from("creator_applications")
    .select("id,status,operations_sync_status")
    .eq("tiktok_handle", tiktokHandle)
    .in("status", [...ACTIVE_APPLICATION_STATUSES])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byHandle.error) throw new Error(`CREATOR_APPLICATION_LOOKUP_FAILED:${byHandle.error.code ?? "unknown"}`);
  return byHandle.data ? byHandle.data as StoredApplication : null;
}

async function updateSyncState(
  client: SupabaseClient,
  applicationId: string,
  status: "synced" | "failed",
  errorMessage?: string,
): Promise<void> {
  const result = await client
    .from("creator_applications")
    .update({
      operations_sync_status: status,
      operations_sync_last_error: errorMessage ? errorMessage.slice(0, 500) : null,
    })
    .eq("id", applicationId);
  if (result.error) {
    console.error("GMVGANG_CREATOR_APPLICATION_SYNC_STATE_FAILED", {
      applicationId,
      code: result.error.code,
    });
  }
}

async function syncToMake(
  config: CreatorApplicationIntakeConfig,
  client: SupabaseClient,
  application: StoredApplication,
  payload: CreatorApplicationPayload,
  submittedAt: string,
): Promise<void> {
  if (!config.makeWebhookUrl || application.operations_sync_status === "synced") return;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-GMVGANG-Event-Id": application.id,
    };
    if (config.makeWebhookSecret?.trim()) headers["X-GMVGANG-Webhook-Secret"] = config.makeWebhookSecret.trim();

    const response = await fetch(config.makeWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "creator.application.submitted",
        applicationId: application.id,
        submittedAt,
        source: "website",
        creator: {
          displayName: payload.displayName,
          email: payload.email,
          phone: payload.phone ?? null,
          tiktokHandle: payload.tiktokHandle,
          followerBand: payload.followerBand,
          contentCategories: payload.contentCategories,
          tiktokShopExperience: payload.tiktokShopExperience,
          referralCode: payload.referralCode ?? null,
        },
        consent: {
          ageConfirmed: true,
          privacyAccepted: true,
          privacyNoticeVersion: payload.privacyNoticeVersion,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`MAKE_HTTP_${response.status}`);
    await updateSyncState(client, application.id, "synced");
  } catch (error) {
    const code = error instanceof Error ? error.message : "MAKE_SYNC_FAILED";
    console.error("GMVGANG_CREATOR_APPLICATION_MAKE_SYNC_FAILED", { applicationId: application.id, code });
    await updateSyncState(client, application.id, "failed", code);
  }
}

export function createCreatorApplicationIntakeHandler(config: CreatorApplicationIntakeConfig) {
  const allowedOrigins = [...new Set(config.allowedOrigins.map((origin) => new URL(origin).origin))];
  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const limiter = createFixedWindowRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

  return async function handleCreatorApplicationIntake(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const origin = originFor(request, allowedOrigins);

    if (pathname === "/api/public/creator-application/config") {
      if (request.method === "OPTIONS") {
        if (!origin) return json({ error: "origin_not_allowed" }, 403);
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "600",
            Vary: "Origin",
          },
        });
      }
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin ?? undefined);
      if (!origin) return json({ error: "origin_not_allowed" }, 403);
      return json({ ok: true, privacyNoticeVersion: config.privacyNoticeVersion }, 200, origin);
    }

    if (pathname !== "/api/public/creator-application") return json({ error: "not_found" }, 404, origin ?? undefined);

    if (request.method === "OPTIONS") {
      if (!origin) return json({ error: "origin_not_allowed" }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        },
      });
    }

    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin ?? undefined);
    if (!origin) return json({ ok: false, errors: ["origin_not_allowed"] }, 403);
    if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
      return json({ ok: false, errors: ["json_required"] }, 415, origin);
    }

    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return json({ ok: false, errors: ["invalid_idempotency_key"] }, 400, origin);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ ok: false, errors: ["invalid_json"] }, 400, origin);
    }

    const parsed = parsePayload(raw, config.privacyNoticeVersion);
    if (!parsed.ok) {
      const status = parsed.errors.includes("privacy_notice_version_outdated") ? 409 : 400;
      return json({ ok: false, errors: parsed.errors }, status, origin);
    }

    if (parsed.value.company) {
      return json({ ok: true, accepted: true }, 202, origin);
    }

    const rateLimitKey = `${clientIp(request)}|${parsed.value.email}`;
    if (!limiter.consume(rateLimitKey)) {
      const response = json({ ok: false, errors: ["rate_limited"] }, 429, origin);
      response.headers.set("Retry-After", "900");
      return response;
    }

    const submittedAt = new Date().toISOString();
    const existing = await findStored(client, idempotencyKey, parsed.value.tiktokHandle);
    if (existing) {
      await syncToMake(config, client, existing, parsed.value, submittedAt);
      return json({ ok: true, accepted: true, created: false, applicationId: existing.id }, 200, origin);
    }

    const record: ApplicationRecord = {
      idempotency_key: idempotencyKey,
      display_name: parsed.value.displayName,
      email: parsed.value.email,
      phone: parsed.value.phone ?? null,
      tiktok_handle: parsed.value.tiktokHandle,
      follower_band: parsed.value.followerBand,
      content_categories: parsed.value.contentCategories,
      tiktok_shop_experience: parsed.value.tiktokShopExperience,
      referral_code: parsed.value.referralCode ?? null,
      source: "website",
      status: "new",
      age_confirmed: true,
      privacy_accepted: true,
      privacy_notice_version: parsed.value.privacyNoticeVersion,
      operations_sync_status: "pending",
      submitted_at: submittedAt,
    };

    const inserted = await client
      .from("creator_applications")
      .insert(record)
      .select("id,status,operations_sync_status")
      .single();

    let application: StoredApplication | null = inserted.data ? inserted.data as StoredApplication : null;
    if (inserted.error) {
      if (inserted.error.code !== "23505") {
        throw new Error(`CREATOR_APPLICATION_INSERT_FAILED:${inserted.error.code ?? "unknown"}`);
      }
      application = await findStored(client, idempotencyKey, parsed.value.tiktokHandle);
      if (!application) throw new Error("CREATOR_APPLICATION_CONFLICT_UNRESOLVED");
    }

    if (!application) throw new Error("CREATOR_APPLICATION_INSERT_RESPONSE_INVALID");
    await syncToMake(config, client, application, parsed.value, submittedAt);

    return json({ ok: true, accepted: true, created: !inserted.error, applicationId: application.id }, inserted.error ? 200 : 201, origin);
  };
}
