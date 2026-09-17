import type { SupabaseClient } from "@supabase/supabase-js";

type ParallelV1Dependencies = {
  requestClient: SupabaseClient;
  adminClient: SupabaseClient;
  now: string;
  requestId: string;
};

type AuthenticatedIdentity = {
  userId: string;
  email: string | null;
  memberships: Array<{ organization_id: string; role: string; status: string }>;
  creatorProfileId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,128}$/;
const BRAND_WRITE_ROLES = new Set(["founder", "admin", "brand_manager", "brand_member"]);
const CONTENT_FORMATS = new Set([
  "shoppable_video",
  "live_shopping",
  "ugc",
  "entertainment_community",
  "reviews",
  "tutorials",
  "lifestyle",
  "other",
]);
const LIVE_STATUSES = new Set(["unknown", "not_live", "occasional", "regular"]);
const SHOP_STATUSES = new Set(["not_connected", "setup", "active", "paused"]);
const BRAND_STATUSES = new Set(["lead", "qualified", "onboarding", "active", "paused", "churned"]);
const BRAND_GOALS = new Set(["creator_growth", "content_testing", "shop_growth", "live_growth", "profitability"]);
const PRODUCT_STATUSES = new Set(["draft", "active", "archived"]);
const OUTREACH_STATUSES = new Set(["queued", "ready", "sent", "replied", "accepted", "declined", "stopped"]);
const SAMPLE_STATUSES = new Set(["not_requested", "requested", "approved", "rejected", "ordered", "shipped", "delivered", "content_due", "posted", "closed"]);
const CONTENT_STATUSES = new Set(["not_started", "briefed", "in_progress", "posted", "cancelled"]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_TEXT");
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error("INVALID_TEXT");
  return cleaned;
}

function cleanEmail(value: unknown): string | null {
  const cleaned = cleanText(value, 254);
  if (!cleaned) return null;
  const normalized = cleaned.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("INVALID_EMAIL");
  return normalized;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_NUMBER");
  return value;
}

function boundedInteger(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = nonNegativeInteger(value, fallback);
  if (parsed < min || parsed > max) throw new Error("INVALID_NUMBER");
  return parsed;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("INVALID_ID");
  return value;
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

async function identity(deps: ParallelV1Dependencies): Promise<AuthenticatedIdentity> {
  const { data: userData, error: userError } = await deps.requestClient.auth.getUser();
  if (userError || !userData.user) throw new Error("AUTHENTICATION_REQUIRED");

  const [membershipsResult, profileResult] = await Promise.all([
    deps.requestClient
      .from("memberships")
      .select("organization_id,role,status")
      .eq("user_id", userData.user.id)
      .eq("status", "active"),
    deps.requestClient
      .from("creator_profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
  ]);
  if (membershipsResult.error) throw new Error("MEMBERSHIP_READ_FAILED");
  if (profileResult.error) throw new Error("CREATOR_PROFILE_READ_FAILED");

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    memberships: membershipsResult.data ?? [],
    creatorProfileId: profileResult.data?.id ?? null,
  };
}

function selectedOrganizationId(request: Request): string | null {
  const raw = request.headers.get("x-gmvgang-organization-id")?.trim();
  if (!raw) return null;
  if (!UUID.test(raw)) throw new Error("INVALID_ORGANIZATION");
  return raw;
}

function assertBrandWriteAccess(auth: AuthenticatedIdentity, organizationId: string): void {
  const allowed = auth.memberships.some(
    (membership) => membership.organization_id === organizationId && BRAND_WRITE_ROLES.has(membership.role),
  );
  if (!allowed) throw new Error("BRAND_ACCESS_DENIED");
}

async function assertBrandOrganization(
  deps: ParallelV1Dependencies,
  auth: AuthenticatedIdentity,
  organizationId: string,
): Promise<void> {
  const member = auth.memberships.some((membership) => membership.organization_id === organizationId);
  if (!member) throw new Error("ORGANIZATION_ACCESS_DENIED");
  const { data, error } = await deps.adminClient
    .from("organizations")
    .select("id,type,status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error("ORGANIZATION_READ_FAILED");
  if (!data || data.type !== "brand" || data.status !== "active") throw new Error("BRAND_ACCESS_DENIED");
}

async function activity(
  deps: ParallelV1Dependencies,
  input: {
    auth: AuthenticatedIdentity;
    eventType: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    organizationId?: string | null;
    creatorProfileId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await deps.adminClient.from("workspace_activity_events").insert({
    actor_user_id: input.auth.userId,
    organization_id: input.organizationId ?? null,
    creator_profile_id: input.creatorProfileId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    metadata: {
      requestId: deps.requestId,
      ...(input.metadata ?? {}),
    },
    occurred_at: deps.now,
  });
  if (error) throw new Error("ACTIVITY_WRITE_FAILED");
}

async function readWorkspace(request: Request, deps: ParallelV1Dependencies): Promise<Response> {
  const auth = await identity(deps);
  const organizationId = selectedOrganizationId(request);
  let brand: unknown = null;
  let creator: unknown = null;

  if (organizationId) {
    await assertBrandOrganization(deps, auth, organizationId);
    const [profile, products, campaigns] = await Promise.all([
      deps.adminClient.from("brand_profiles").select("*").eq("organization_id", organizationId).maybeSingle(),
      deps.adminClient.from("brand_products").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
      deps.adminClient.from("campaigns").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
    ]);
    if (profile.error || products.error || campaigns.error) throw new Error("BRAND_WORKSPACE_READ_FAILED");

    const campaignIds = (campaigns.data ?? []).map((item) => item.id);
    const assignments = campaignIds.length
      ? await deps.adminClient
          .from("campaign_creator_assignments")
          .select("id,campaign_id,creator_profile_id,creator_ready,outreach_status,outreach_reply,sample_status,content_status,brief_text,posted_at,gmv_cents,orders,commission_cents,performance_updated_at,updated_at")
          .in("campaign_id", campaignIds)
          .order("updated_at", { ascending: false })
          .limit(500)
      : { data: [], error: null };
    if (assignments.error) throw new Error("BRAND_ASSIGNMENTS_READ_FAILED");

    brand = {
      organizationId,
      profile: profile.data ?? null,
      products: products.data ?? [],
      campaigns: campaigns.data ?? [],
      assignments: assignments.data ?? [],
    };
  }

  if (auth.creatorProfileId) {
    const [onboarding, assignments] = await Promise.all([
      deps.adminClient.from("creator_onboarding").select("*").eq("creator_profile_id", auth.creatorProfileId).maybeSingle(),
      deps.adminClient
        .from("campaign_creator_assignments")
        .select("id,campaign_id,creator_profile_id,creator_ready,outreach_status,outreach_reply,sample_status,content_status,brief_text,posted_at,gmv_cents,orders,commission_cents,performance_updated_at,updated_at")
        .eq("creator_profile_id", auth.creatorProfileId)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (onboarding.error || assignments.error) throw new Error("CREATOR_WORKSPACE_READ_FAILED");

    const campaignIds = (assignments.data ?? []).map((item) => item.campaign_id);
    const campaigns = campaignIds.length
      ? await deps.adminClient
          .from("campaigns")
          .select("id,organization_id,product_id,name,status,client_approved,launched_at,completed_at,updated_at")
          .in("id", campaignIds)
      : { data: [], error: null };
    if (campaigns.error) throw new Error("CREATOR_CAMPAIGNS_READ_FAILED");

    creator = {
      creatorProfileId: auth.creatorProfileId,
      onboarding: onboarding.data ?? null,
      assignments: assignments.data ?? [],
      campaigns: campaigns.data ?? [],
    };
  }

  let activityQuery = deps.adminClient
    .from("workspace_activity_events")
    .select("id,event_type,entity_type,entity_id,summary,organization_id,creator_profile_id,occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (organizationId) {
    activityQuery = activityQuery.eq("organization_id", organizationId);
  } else if (auth.creatorProfileId) {
    activityQuery = activityQuery.eq("creator_profile_id", auth.creatorProfileId);
  } else {
    activityQuery = activityQuery.eq("actor_user_id", auth.userId);
  }
  const activityResult = await activityQuery;
  if (activityResult.error) throw new Error("ACTIVITY_READ_FAILED");

  return json({
    ok: true,
    generatedAt: deps.now,
    brand,
    creator,
    activity: activityResult.data ?? [],
  });
}

function brandProfileCompletion(input: Record<string, unknown>): { percent: number; next: string } {
  const checks = [
    Boolean(cleanText(input.legalName, 200)),
    Boolean(cleanText(input.websiteUrl, 2048)),
    Boolean(cleanEmail(input.contactEmail)),
    Boolean(cleanText(input.contactName, 200)),
    SHOP_STATUSES.has(String(input.tiktokShopStatus ?? "")) && input.tiktokShopStatus !== "not_connected",
  ];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const next = percent >= 100 ? "create_first_campaign" : percent >= 60 ? "add_first_product" : "complete_brand_profile";
  return { percent, next };
}

function creatorOnboardingCompletion(input: Record<string, unknown>): { percent: number; next: string } {
  const formats = Array.isArray(input.contentFormats) ? input.contentFormats : [];
  const checks = [
    typeof input.followerCount === "number" && input.followerCount >= 0,
    formats.length > 0,
    LIVE_STATUSES.has(String(input.liveStatus ?? "")) && input.liveStatus !== "unknown",
  ];
  const percent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const next = percent >= 100 ? "review_opportunities" : formats.length === 0 ? "choose_content_formats" : "complete_creator_onboarding";
  return { percent, next };
}

async function beginIdempotency(
  request: Request,
  deps: ParallelV1Dependencies,
  auth: AuthenticatedIdentity,
  action: string,
  payload: unknown,
): Promise<{ scope: string; key: string; hash: string } | Response> {
  const encoded = new TextEncoder().encode(`${action}:${JSON.stringify(payload)}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const supplied = request.headers.get("idempotency-key")?.trim();
  const key = supplied || `auto:${hash}`;
  if (!IDEMPOTENCY_KEY.test(key)) return json({ error: "idempotency_key_invalid" }, 400);

  const scope = `parallel_v1:${action}`;
  const expiresAt = new Date(Date.parse(deps.now) + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await deps.adminClient.from("mutation_idempotency").insert({
    scope,
    subject: auth.userId,
    idempotency_key: key,
    request_hash: hash,
    state: "pending",
    created_at: deps.now,
    expires_at: expiresAt,
  });
  if (!error) return { scope, key, hash };
  if (error.code !== "23505") throw new Error("IDEMPOTENCY_BEGIN_FAILED");

  const { data, error: readError } = await deps.adminClient
    .from("mutation_idempotency")
    .select("request_hash,state,response_status,response_body")
    .eq("scope", scope)
    .eq("subject", auth.userId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (readError || !data) throw new Error("IDEMPOTENCY_READ_FAILED");
  if (data.request_hash !== hash) return json({ error: "idempotency_key_conflict" }, 409);
  if (data.state !== "completed") return json({ error: "idempotency_in_progress" }, 409, { "Retry-After": "2" });
  return json(data.response_body, Number(data.response_status ?? 200), { "Idempotency-Replayed": "true" });
}

async function completeIdempotency(
  deps: ParallelV1Dependencies,
  auth: AuthenticatedIdentity,
  started: { scope: string; key: string; hash: string },
  responseBody: unknown,
  responseStatus = 200,
): Promise<void> {
  const { error } = await deps.adminClient
    .from("mutation_idempotency")
    .update({
      state: "completed",
      response_status: responseStatus,
      response_body: responseBody,
      completed_at: deps.now,
    })
    .eq("scope", started.scope)
    .eq("subject", auth.userId)
    .eq("idempotency_key", started.key)
    .eq("request_hash", started.hash)
    .eq("state", "pending");
  if (error) throw new Error("IDEMPOTENCY_COMPLETE_FAILED");
}

async function mutateWorkspace(request: Request, deps: ParallelV1Dependencies): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "same_origin_required" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "json_required" }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!isRecord(payload) || typeof payload.action !== "string") return json({ error: "invalid_request" }, 400);

  const auth = await identity(deps);
  const action = payload.action;
  const started = await beginIdempotency(request, deps, auth, action, payload);
  if (started instanceof Response) return started;

  let responseBody: Record<string, unknown>;

  if (action === "creator_onboarding_upsert") {
    if (!auth.creatorProfileId) throw new Error("CREATOR_PROFILE_REQUIRED");
    const formats = Array.isArray(payload.contentFormats)
      ? payload.contentFormats.map((item) => String(item))
      : [];
    if (formats.some((item) => !CONTENT_FORMATS.has(item)) || formats.length > 8) throw new Error("INVALID_CONTENT_FORMATS");
    const liveStatus = String(payload.liveStatus ?? "unknown");
    if (!LIVE_STATUSES.has(liveStatus)) throw new Error("INVALID_LIVE_STATUS");
    const followerCount = payload.followerCount === null || payload.followerCount === undefined
      ? null
      : nonNegativeInteger(payload.followerCount);
    const completion = creatorOnboardingCompletion({
      followerCount,
      contentFormats: formats,
      liveStatus,
    });
    const { data, error } = await deps.adminClient
      .from("creator_onboarding")
      .upsert({
        creator_profile_id: auth.creatorProfileId,
        follower_count: followerCount,
        content_formats: formats,
        live_status: liveStatus,
        onboarding_status: completion.percent === 100 ? "complete" : "in_progress",
        onboarding_completion_percent: completion.percent,
        next_best_action: completion.next,
      }, { onConflict: "creator_profile_id" })
      .select("*")
      .single();
    if (error) throw new Error("CREATOR_ONBOARDING_WRITE_FAILED");
    await activity(deps, {
      auth,
      eventType: "creator.onboarding.updated",
      entityType: "creator_onboarding",
      entityId: auth.creatorProfileId,
      creatorProfileId: auth.creatorProfileId,
      summary: completion.percent === 100 ? "Creator-Onboarding abgeschlossen" : "Creator-Onboarding aktualisiert",
      metadata: { completionPercent: completion.percent },
    });
    responseBody = { ok: true, onboarding: data };
  } else {
    const organizationId = selectedOrganizationId(request);
    if (!organizationId) throw new Error("ORGANIZATION_REQUIRED");

    if (action === "content_submit") {
      if (!auth.creatorProfileId) throw new Error("CREATOR_PROFILE_REQUIRED");
      const assignmentId = uuid(payload.assignmentId);
      const contentUrl = cleanText(payload.contentUrl, 2048);
      if (!contentUrl || !/^https?:\/\//i.test(contentUrl)) throw new Error("INVALID_CONTENT_URL");
      const { data: assignment, error: assignmentError } = await deps.adminClient
        .from("campaign_creator_assignments")
        .select("id,campaign_id,creator_profile_id")
        .eq("id", assignmentId)
        .eq("creator_profile_id", auth.creatorProfileId)
        .maybeSingle();
      if (assignmentError || !assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const { data: campaign, error: campaignError } = await deps.adminClient
        .from("campaigns")
        .select("organization_id")
        .eq("id", assignment.campaign_id)
        .maybeSingle();
      if (campaignError || !campaign || campaign.organization_id !== organizationId) throw new Error("ASSIGNMENT_NOT_FOUND");
      const { data, error } = await deps.adminClient.from("content_submissions").insert({
        assignment_id: assignmentId,
        content_url: contentUrl,
        status: "submitted",
        submitted_at: deps.now,
      }).select("*").single();
      if (error) throw new Error("CONTENT_SUBMISSION_FAILED");
      await deps.adminClient.from("campaign_creator_assignments").update({
        content_status: "in_progress",
      }).eq("id", assignmentId);
      await activity(deps, {
        auth,
        eventType: "creator.content.submitted",
        entityType: "content_submission",
        entityId: data.id,
        organizationId,
        creatorProfileId: auth.creatorProfileId,
        summary: "Content zur Prüfung eingereicht",
        metadata: { assignmentId },
      });
      responseBody = { ok: true, contentSubmission: data };
    } else if (action === "creator_assignment_response") {
      if (!auth.creatorProfileId) throw new Error("CREATOR_PROFILE_REQUIRED");
      const assignmentId = uuid(payload.assignmentId);
      const decision = String(payload.decision ?? "");
      if (decision !== "accepted" && decision !== "declined") throw new Error("INVALID_DECISION");
      const { data: currentAssignment, error: currentAssignmentError } = await deps.adminClient
        .from("campaign_creator_assignments")
        .select("id,campaign_id,creator_profile_id")
        .eq("id", assignmentId)
        .eq("creator_profile_id", auth.creatorProfileId)
        .maybeSingle();
      if (currentAssignmentError || !currentAssignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const { data: campaign, error: campaignError } = await deps.adminClient
        .from("campaigns")
        .select("organization_id")
        .eq("id", currentAssignment.campaign_id)
        .maybeSingle();
      if (campaignError || !campaign || campaign.organization_id !== organizationId) throw new Error("ASSIGNMENT_NOT_FOUND");
      const { data, error } = await deps.adminClient
        .from("campaign_creator_assignments")
        .update({
          outreach_status: decision,
          outreach_reply: decision,
        })
        .eq("id", assignmentId)
        .eq("creator_profile_id", auth.creatorProfileId)
        .select("*")
        .maybeSingle();
      if (error || !data) throw new Error("ASSIGNMENT_NOT_FOUND");
      await activity(deps, {
        auth,
        eventType: `creator.opportunity.${decision}`,
        entityType: "campaign_assignment",
        entityId: assignmentId,
        organizationId,
        creatorProfileId: auth.creatorProfileId,
        summary: decision === "accepted" ? "Creator hat die Opportunity angenommen" : "Creator hat die Opportunity abgelehnt",
      });
      responseBody = { ok: true, assignment: data };
    } else {
      await assertBrandOrganization(deps, auth, organizationId);
      assertBrandWriteAccess(auth, organizationId);

      if (action === "brand_profile_upsert") {
        const legalName = cleanText(payload.legalName, 200);
        const websiteUrl = cleanText(payload.websiteUrl, 2048);
        const contactName = cleanText(payload.contactName, 200);
        const contactEmail = cleanEmail(payload.contactEmail);
        const status = String(payload.status ?? "onboarding");
        const tiktokShopStatus = String(payload.tiktokShopStatus ?? "not_connected");
        const primaryGoal = String(payload.primaryGoal ?? "creator_growth");
        if (!BRAND_STATUSES.has(status) || !SHOP_STATUSES.has(tiktokShopStatus) || !BRAND_GOALS.has(primaryGoal)) {
          throw new Error("INVALID_BRAND_PROFILE");
        }
        const completion = brandProfileCompletion({
          legalName,
          websiteUrl,
          contactName,
          contactEmail,
          tiktokShopStatus,
        });
        const { data, error } = await deps.adminClient
          .from("brand_profiles")
          .upsert({
            organization_id: organizationId,
            legal_name: legalName,
            website_url: websiteUrl,
            country_code: "DE",
            status,
            tiktok_shop_status: tiktokShopStatus,
            primary_goal: primaryGoal,
            contact_name: contactName,
            contact_email: contactEmail,
            onboarding_completion_percent: completion.percent,
            next_best_action: completion.next,
          }, { onConflict: "organization_id" })
          .select("*")
          .single();
        if (error) throw new Error("BRAND_PROFILE_WRITE_FAILED");
        await activity(deps, {
          auth,
          eventType: "brand.onboarding.updated",
          entityType: "brand_profile",
          entityId: data.id,
          organizationId,
          summary: completion.percent === 100 ? "Brand-Onboarding abgeschlossen" : "Brand-Onboarding aktualisiert",
          metadata: { completionPercent: completion.percent },
        });
        responseBody = { ok: true, brandProfile: data };
      } else if (action === "brand_product_upsert") {
        const id = payload.id ? uuid(payload.id) : undefined;
        const name = cleanText(payload.name, 200);
        const sku = cleanText(payload.sku, 128);
        const status = String(payload.status ?? "draft");
        if (!name || !sku || !PRODUCT_STATUSES.has(status)) throw new Error("INVALID_PRODUCT");
        const row = {
          organization_id: organizationId,
          name,
          sku,
          status,
          sale_price_cents: nonNegativeInteger(payload.salePriceCents),
          cogs_cents: nonNegativeInteger(payload.cogsCents),
          affiliate_commission_bps: boundedInteger(payload.affiliateCommissionBps, 0, 10000),
          sample_cost_cents: nonNegativeInteger(payload.sampleCostCents),
          inventory_units: nonNegativeInteger(payload.inventoryUnits),
          tiktok_shop_url: cleanText(payload.tiktokShopUrl, 2048),
          image_url: cleanText(payload.imageUrl, 2048),
        };
        const query = id
          ? deps.adminClient.from("brand_products").update(row).eq("id", id).eq("organization_id", organizationId)
          : deps.adminClient.from("brand_products").insert(row);
        const { data, error } = await query.select("*").single();
        if (error) throw new Error(error.code === "23505" ? "PRODUCT_SKU_CONFLICT" : "PRODUCT_WRITE_FAILED");
        await activity(deps, {
          auth,
          eventType: id ? "brand.product.updated" : "brand.product.created",
          entityType: "brand_product",
          entityId: data.id,
          organizationId,
          summary: id ? `Produkt ${name} aktualisiert` : `Produkt ${name} angelegt`,
          metadata: { sku },
        });
        responseBody = { ok: true, product: data };
      } else if (action === "campaign_create") {
        const name = cleanText(payload.name, 200);
        if (!name) throw new Error("INVALID_CAMPAIGN");
        const productId = payload.productId ? uuid(payload.productId) : null;
        if (productId) {
          const { data: product, error: productError } = await deps.adminClient
            .from("brand_products")
            .select("id")
            .eq("id", productId)
            .eq("organization_id", organizationId)
            .maybeSingle();
          if (productError || !product) throw new Error("PRODUCT_NOT_FOUND");
        }
        const { data, error } = await deps.adminClient.from("campaigns").insert({
          organization_id: organizationId,
          product_id: productId,
          name,
          status: "draft",
          client_approved: false,
          created_by_user_id: auth.userId,
        }).select("*").single();
        if (error) throw new Error("CAMPAIGN_CREATE_FAILED");
        await activity(deps, {
          auth,
          eventType: "campaign.created",
          entityType: "campaign",
          entityId: data.id,
          organizationId,
          summary: `Campaign ${name} angelegt`,
        });
        responseBody = { ok: true, campaign: data };
      } else if (action === "campaign_assignment_upsert") {
        const campaignId = uuid(payload.campaignId);
        const creatorProfileId = uuid(payload.creatorProfileId);
        const { data: campaign, error: campaignError } = await deps.adminClient
          .from("campaigns")
          .select("id")
          .eq("id", campaignId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (campaignError || !campaign) throw new Error("CAMPAIGN_NOT_FOUND");
        const { data: creatorProfile, error: creatorError } = await deps.adminClient
          .from("creator_profiles")
          .select("id")
          .eq("id", creatorProfileId)
          .maybeSingle();
        if (creatorError || !creatorProfile) throw new Error("CREATOR_NOT_FOUND");

        const outreachStatus = String(payload.outreachStatus ?? "queued");
        const sampleStatus = String(payload.sampleStatus ?? "not_requested");
        const contentStatus = String(payload.contentStatus ?? "not_started");
        if (!OUTREACH_STATUSES.has(outreachStatus) || !SAMPLE_STATUSES.has(sampleStatus) || !CONTENT_STATUSES.has(contentStatus)) {
          throw new Error("INVALID_ASSIGNMENT_STATE");
        }

        const { data, error } = await deps.adminClient
          .from("campaign_creator_assignments")
          .upsert({
            campaign_id: campaignId,
            creator_profile_id: creatorProfileId,
            creator_ready: Boolean(payload.creatorReady),
            outreach_status: outreachStatus,
            sample_status: sampleStatus,
            content_status: contentStatus,
            brief_text: cleanText(payload.briefText, 10000),
          }, { onConflict: "campaign_id,creator_profile_id" })
          .select("*")
          .single();
        if (error) throw new Error("ASSIGNMENT_WRITE_FAILED");
        await activity(deps, {
          auth,
          eventType: "campaign.creator.assigned",
          entityType: "campaign_assignment",
          entityId: data.id,
          organizationId,
          creatorProfileId,
          summary: "Creator einer Campaign zugeordnet",
          metadata: { campaignId },
        });
        responseBody = { ok: true, assignment: data };
      } else {
        throw new Error("UNKNOWN_ACTION");
      }
    }
  }

  await completeIdempotency(deps, auth, started, responseBody);
  return json(responseBody);
}

function errorResponse(error: unknown): Response {
  const code = (error instanceof Error ? error.message.split(":", 1)[0] : "INTERNAL_ERROR") ?? "INTERNAL_ERROR";
  if (code === "AUTHENTICATION_REQUIRED") return json({ error: "authentication_required" }, 401);
  if (
    code === "BRAND_ACCESS_DENIED" ||
    code === "ORGANIZATION_ACCESS_DENIED"
  ) return json({ error: "access_denied" }, 403);
  if (
    code === "ASSIGNMENT_NOT_FOUND" ||
    code === "CAMPAIGN_NOT_FOUND" ||
    code === "CREATOR_NOT_FOUND" ||
    code === "PRODUCT_NOT_FOUND"
  ) return json({ error: code.toLowerCase() }, 404);
  if (code === "PRODUCT_SKU_CONFLICT") return json({ error: "product_sku_conflict" }, 409);
  if (
    code.startsWith("INVALID_") ||
    code === "CREATOR_PROFILE_REQUIRED" ||
    code === "ORGANIZATION_REQUIRED" ||
    code === "UNKNOWN_ACTION"
  ) return json({ error: code.toLowerCase() }, 400);
  console.error("GMVGANG_PARALLEL_V1_FAILED", { code });
  return json({ error: "internal_error" }, 500);
}

export async function handleParallelV1(
  request: Request,
  deps: ParallelV1Dependencies,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/api/v1/workspace" && pathname !== "/api/v1/mutate") return null;

  try {
    if (pathname === "/api/v1/workspace") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { Allow: "GET" });
      return await readWorkspace(request, deps);
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    return await mutateWorkspace(request, deps);
  } catch (error) {
    return errorResponse(error);
  }
}
