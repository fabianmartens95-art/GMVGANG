import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
const ALLOWED_ORIGINS = new Set(["https://gmvgang.de", "https://www.gmvgang.de"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = new Set(["Beauty", "Food", "Home & Living", "Fashion", "Electronics", "Health & Wellness", "Pet", "Sonstiges"]);
const GOALS = new Set(["Shop aufbauen", "Creator gewinnen", "Content testen", "Shop verbessern", "LIVE testen", "Potenzial klären"]);
const BANDS = {
  veryHigh: "SEHR HOHES POTENZIAL",
  good: "GUTES POTENZIAL",
  leverage: "POTENZIAL MIT KLAREN HEBELN",
  selective: "AKTUELL SELEKTIV TESTEN",
  prerequisites: "VORAUSSETZUNGEN ZUERST KLÄREN",
} as const;

type IntakeRecord = Record<string, unknown>;

type ParsedIntake = {
  submissionId: string;
  brandName: string;
  websiteUrl: string;
  category: string;
  shopStatus: number;
  demoFit: number;
  creatorFit: number;
  contentDepth: number;
  creatorHistory: number;
  marginScore: number | null;
  marginUnknown: boolean;
  samples: number;
  ops: number;
  goal: string;
  contactName: string;
  email: string;
  note: string | null;
  sourceUrl: string;
};

function cors(origin: string | null): HeadersInit {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return { "Vary": "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function json(origin: string | null, body: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors(origin),
      ...extra,
    },
  });
}

function record(value: unknown): IntakeRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as IntakeRecord : null;
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (cleaned.length > max) return undefined;
  return cleaned || null;
}

function selectedNumber(value: unknown, allowed: readonly number[]): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && allowed.includes(parsed) ? parsed : null;
}

function validHttpUrl(value: string, allowedHosts?: Set<string>): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}

function parseInput(body: unknown): ParsedIntake | null {
  const outer = record(body);
  const submissionId = cleanString(outer?.submissionId, 64);
  const payload = record(outer?.payload);
  const data = record(payload?.data);
  if (!outer || !submissionId || !UUID.test(submissionId) || !data) return null;

  const brandName = cleanString(data.brand, 200);
  const websiteUrl = cleanString(data.website, 2048);
  const category = cleanString(data.category, 80);
  const contactName = cleanString(data.contact_name, 200);
  const emailValue = cleanString(data.email, 254);
  const goal = cleanString(data.goal, 100);
  const sourceUrl = cleanString(data.source_url, 2048);
  const note = optionalString(data.note, 5000);
  if (
    !brandName || !websiteUrl || !validHttpUrl(websiteUrl) || !category || !CATEGORIES.has(category) ||
    !contactName || !emailValue || !EMAIL.test(emailValue) || !goal || !GOALS.has(goal) ||
    !sourceUrl || !validHttpUrl(sourceUrl, new Set(["gmvgang.de", "www.gmvgang.de"])) || note === undefined
  ) return null;

  const shopStatus = selectedNumber(data.shop_status, [0, 5, 8, 10]);
  const demoFit = selectedNumber(data.demo_fit, [25, 18, 10, 3]);
  const creatorFit = selectedNumber(data.creator_fit, [25, 18, 10, 3]);
  const contentDepth = selectedNumber(data.content_depth, [15, 10, 5, 0]);
  const creatorHistory = selectedNumber(data.creator_history, [10, 7, 3]);
  const samples = selectedNumber(data.samples, [10, 7, 2]);
  const ops = selectedNumber(data.ops, [10, 7, 3]);
  const marginRaw = typeof data.margin === "string" ? data.margin.trim() : data.margin;
  const marginUnknown = marginRaw === "unknown";
  const marginScore = marginUnknown ? null : selectedNumber(marginRaw, [15, 12, 7, 2]);
  if ([shopStatus, demoFit, creatorFit, contentDepth, creatorHistory, samples, ops].some((value) => value === null)) return null;
  if (!marginUnknown && marginScore === null) return null;

  return {
    submissionId,
    brandName,
    websiteUrl,
    category,
    shopStatus: shopStatus!,
    demoFit: demoFit!,
    creatorFit: creatorFit!,
    contentDepth: contentDepth!,
    creatorHistory: creatorHistory!,
    marginScore,
    marginUnknown,
    samples: samples!,
    ops: ops!,
    goal,
    contactName,
    email: emailValue.toLowerCase(),
    note: note ?? null,
    sourceUrl,
  };
}

function scoreIntake(input: ParsedIntake) {
  const margin = input.marginScore ?? 0;
  const total = input.shopStatus + input.demoFit + input.creatorFit + input.contentDepth + input.creatorHistory + margin + input.samples + input.ops;
  const score = Math.round((total / 120) * 100);
  const risk = input.marginUnknown || margin < 7 || input.ops < 7;
  let band: string = score >= 80 ? BANDS.veryHigh : score >= 65 ? BANDS.good : score >= 45 ? BANDS.leverage : BANDS.selective;
  if (risk) band = BANDS.prerequisites;
  const grade = risk ? "C – Mittel" : score >= 80 ? "A – Sehr hoch" : score >= 65 ? "B – Hoch" : score >= 45 ? "C – Mittel" : "D – Niedrig";
  return { score: input.marginUnknown ? null : score, band, grade, tiktokShopLive: input.shopStatus >= 8 };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceHeaders(): HeadersInit {
  return {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function rateLimitAllowed(email: string, now: string): Promise<boolean> {
  const subjectHash = await sha256(email);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_brand_intake_rate_limit`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ p_subject_hash: subjectHash, p_now: now, p_limit: 5, p_window_seconds: 600 }),
  });
  if (!response.ok) throw new Error(`RATE_LIMIT_BACKEND_${response.status}`);
  return await response.json() === true;
}

async function existingIntake(submissionId: string): Promise<Record<string, unknown> | null> {
  const query = new URLSearchParams({
    submission_id: `eq.${submissionId}`,
    select: "id,potential_score,potential_band",
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/brand_intakes?${query}`, {
    headers: serviceHeaders(),
  });
  if (!response.ok) throw new Error(`INTAKE_LOOKUP_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] as Record<string, unknown> : null;
}

async function insertIntake(input: ParsedIntake, scored: ReturnType<typeof scoreIntake>) {
  const summary = `Website Potenzial-Check V2 | ${scored.score === null ? "Score offen" : `Score ${scored.score}/100`} | ${scored.band} | Branche: ${input.category} | Shop: ${input.shopStatus} | Produkt: ${input.demoFit} | Creator: ${input.creatorFit} | Content: ${input.contentDepth} | Erfahrung: ${input.creatorHistory} | Bruttomarge: ${input.marginUnknown ? "unbekannt" : input.marginScore} | Samples: ${input.samples} | Versand: ${input.ops} | Ziel: ${input.goal}${scored.band === BANDS.prerequisites ? " | Manuelle Prüfung vor Skalierung erforderlich." : ""}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/brand_intakes?on_conflict=submission_id`, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "Prefer": "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({
      submission_id: input.submissionId,
      source: "website_potential_check",
      brand_name: input.brandName,
      website_url: input.websiteUrl,
      category: input.category,
      shop_status: input.shopStatus,
      demo_fit: input.demoFit,
      creator_fit: input.creatorFit,
      content_depth: input.contentDepth,
      creator_history: input.creatorHistory,
      margin_score: input.marginScore,
      margin_unknown: input.marginUnknown,
      samples: input.samples,
      ops: input.ops,
      goal: input.goal,
      contact_name: input.contactName,
      business_email: input.email,
      note: input.note,
      potential_score: scored.score,
      potential_band: scored.band,
      potential_grade: scored.grade,
      tiktok_shop_live: scored.tiktokShopLive,
      assessment_summary: summary,
      source_url: input.sourceUrl,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("brand_intake_insert_failed", response.status, detail.slice(0, 500));
    throw new Error(`INTAKE_INSERT_${response.status}`);
  }
  const rows = await response.json();
  if (Array.isArray(rows) && rows.length) return { row: rows[0] as Record<string, unknown>, replayed: false };
  const existing = await existingIntake(input.submissionId);
  if (!existing) throw new Error("INTAKE_DUPLICATE_LOOKUP_MISSING");
  return { row: existing, replayed: true };
}

async function auditIntake(row: Record<string, unknown>, scored: ReturnType<typeof scoreIntake>, now: string): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/platform_audit_events`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Prefer": "return=minimal" },
      body: JSON.stringify({
        event: "brand_intake.received",
        occurred_at: now,
        metadata: {
          intake_id: row.id,
          source: "website_potential_check",
          potential_score: scored.score,
          potential_band: scored.band,
          potential_grade: scored.grade,
        },
      }),
    });
    if (!response.ok) console.error("brand_intake_audit_failed", response.status);
  } catch (error) {
    console.error("brand_intake_audit_failed", error);
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return json(origin, { error: "origin_denied" }, 403);
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") return json(origin, { error: "method_not_allowed" }, 405, { "Allow": "POST, OPTIONS" });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json(origin, { saved: false, error: "origin_denied" }, 403);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(origin, { saved: false, error: "service_unavailable" }, 503);
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return json(origin, { saved: false, error: "json_required" }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(origin, { saved: false, error: "invalid_json" }, 400);
  }
  const input = parseInput(body);
  if (!input) return json(origin, { saved: false, error: "invalid_request" }, 400);

  const now = new Date().toISOString();
  try {
    if (!await rateLimitAllowed(input.email, now)) {
      return json(origin, { saved: false, error: "rate_limited" }, 429, { "Retry-After": "600" });
    }
    const scored = scoreIntake(input);
    const { row, replayed } = await insertIntake(input, scored);
    if (!replayed) await auditIntake(row, scored, now);
    return json(origin, {
      saved: true,
      intakeId: row.id,
      score: row.potential_score ?? scored.score,
      band: row.potential_band ?? scored.band,
      replayed,
    }, replayed ? 200 : 201);
  } catch (error) {
    console.error("brand_intake_unavailable", error);
    return json(origin, { saved: false, error: "save_unavailable" }, 503);
  }
});
