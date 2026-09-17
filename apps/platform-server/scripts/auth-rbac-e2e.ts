import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function projectRefFromUrl(value: string): string {
  const hostname = new URL(value).hostname;
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (!match?.[1]) throw new Error("E2E_SUPABASE_URL_INVALID");
  return match[1];
}

function assertSafeTarget(baseUrl: string, supabaseUrl: string): void {
  if (process.env.E2E_ALLOW_AUTH_MUTATION !== "1") {
    throw new Error("E2E_ALLOW_AUTH_MUTATION_REQUIRED");
  }

  const base = new URL(baseUrl);
  if (base.hostname === "app.gmvgang.de") {
    throw new Error("E2E_PRODUCTION_APP_FORBIDDEN");
  }

  const productionRef = required("E2E_PRODUCTION_SUPABASE_PROJECT_REF");
  const targetRef = projectRefFromUrl(supabaseUrl);
  if (targetRef === productionRef) {
    throw new Error("E2E_PRODUCTION_SUPABASE_FORBIDDEN");
  }
}

function adminClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function publicClient(url: string, publishableKey: string): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function createUser(admin: SupabaseClient, label: string): Promise<{ id: string; email: string }> {
  const email = `gmvgang-e2e-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user?.id) throw new Error(`E2E_CREATE_USER_FAILED:${label}:${error?.message ?? "missing_user"}`);
  return { id: data.user.id, email };
}

async function accessToken(
  admin: SupabaseClient,
  publicAuth: SupabaseClient,
  email: string,
): Promise<string> {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw new Error(`E2E_GENERATE_LINK_FAILED:${linkError.message}`);

  const tokenHash = (link.properties as { hashed_token?: string } | null)?.hashed_token;
  if (!tokenHash) throw new Error("E2E_GENERATE_LINK_TOKEN_HASH_MISSING");

  const { data, error } = await publicAuth.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error || !data.session?.access_token) {
    throw new Error(`E2E_VERIFY_OTP_FAILED:${error?.message ?? "missing_session"}`);
  }
  return data.session.access_token;
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  input: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const base = new URL(baseUrl);
  const headers = new Headers({ Accept: "application/json" });
  if (input.token) headers.set("Authorization", `Bearer ${input.token}`);
  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Origin", base.origin);
    headers.set("Sec-Fetch-Site", "same-origin");
  }

  const response = await fetch(new URL(path, base), {
    method: input.method ?? "GET",
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    redirect: "error",
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function expectStatus(actual: { status: number; body: unknown }, expected: number, label: string): void {
  if (actual.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual.status}: ${JSON.stringify(actual.body)}`);
  }
}

function authenticatedRoles(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  if (record.status !== "authenticated" || !Array.isArray(record.roles)) return [];
  return record.roles.filter((role): role is string => typeof role === "string");
}

const baseUrl = required("E2E_BASE_URL");
const supabaseUrl = required("E2E_SUPABASE_URL");
const publishableKey = required("E2E_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");
assertSafeTarget(baseUrl, supabaseUrl);

const admin = adminClient(supabaseUrl, serviceRoleKey);
const publicAuth = publicClient(supabaseUrl, publishableKey);
const createdUserIds: string[] = [];

try {
  const { data: organizations, error: organizationError } = await admin
    .from("organizations")
    .select("id,type,status")
    .eq("type", "gmvgang")
    .eq("status", "active");
  if (organizationError || organizations?.length !== 1 || typeof organizations[0]?.id !== "string") {
    throw new Error(`E2E_GMVGANG_ORG_INVALID:${organizationError?.message ?? organizations?.length ?? 0}`);
  }
  const organizationId = organizations[0].id;

  const founder = await createUser(admin, "founder");
  const adminUser = await createUser(admin, "admin");
  const managedUser = await createUser(admin, "managed");
  createdUserIds.push(founder.id, adminUser.id, managedUser.id);

  const now = new Date().toISOString();
  const { error: founderMembershipError } = await admin.from("memberships").insert({
    user_id: founder.id,
    organization_id: organizationId,
    role: "founder",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  if (founderMembershipError) {
    throw new Error(`E2E_FOUNDER_BOOTSTRAP_FAILED:${founderMembershipError.message}`);
  }

  const founderToken = await accessToken(admin, publicAuth, founder.email);
  const adminToken = await accessToken(admin, publicAuth, adminUser.email);
  const managedToken = await accessToken(admin, publicAuth, managedUser.email);

  const founderSession = await jsonRequest(baseUrl, "/api/session", { token: founderToken });
  expectStatus(founderSession, 200, "founder session");
  if (!authenticatedRoles(founderSession.body).includes("founder")) {
    throw new Error(`E2E_FOUNDER_ROLE_MISSING:${JSON.stringify(founderSession.body)}`);
  }

  const createAdmin = await jsonRequest(baseUrl, "/api/memberships", {
    method: "PUT",
    token: founderToken,
    body: {
      targetUserId: adminUser.id,
      organizationId,
      role: "admin",
      status: "active",
    },
  });
  expectStatus(createAdmin, 200, "founder creates admin");

  const adminSession = await jsonRequest(baseUrl, "/api/session", { token: adminToken });
  expectStatus(adminSession, 200, "admin session");
  if (!authenticatedRoles(adminSession.body).includes("admin")) {
    throw new Error(`E2E_ADMIN_ROLE_MISSING:${JSON.stringify(adminSession.body)}`);
  }

  const adminEscalation = await jsonRequest(baseUrl, "/api/memberships", {
    method: "PUT",
    token: adminToken,
    body: {
      targetUserId: managedUser.id,
      organizationId,
      role: "admin",
      status: "active",
    },
  });
  expectStatus(adminEscalation, 403, "admin privilege escalation");

  const createManager = await jsonRequest(baseUrl, "/api/memberships", {
    method: "PUT",
    token: founderToken,
    body: {
      targetUserId: managedUser.id,
      organizationId,
      role: "creator_manager",
      status: "active",
    },
  });
  expectStatus(createManager, 200, "founder creates creator manager");

  const managerSession = await jsonRequest(baseUrl, "/api/session", { token: managedToken });
  expectStatus(managerSession, 200, "creator manager session");
  if (!authenticatedRoles(managerSession.body).includes("creator_manager")) {
    throw new Error(`E2E_CREATOR_MANAGER_ROLE_MISSING:${JSON.stringify(managerSession.body)}`);
  }

  const managerMutation = await jsonRequest(baseUrl, "/api/memberships", {
    method: "PUT",
    token: managedToken,
    body: {
      targetUserId: managedUser.id,
      organizationId,
      role: "creator_manager",
      status: "active",
    },
  });
  expectStatus(managerMutation, 403, "creator manager membership mutation");

  const protectedFounderMutation = await jsonRequest(baseUrl, "/api/memberships", {
    method: "PUT",
    token: founderToken,
    body: {
      targetUserId: managedUser.id,
      organizationId,
      role: "founder",
      status: "active",
    },
  });
  expectStatus(protectedFounderMutation, 403, "runtime founder mutation");

  const { count, error: auditError } = await admin
    .from("platform_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("event", "membership.changed")
    .eq("user_id", founder.id);
  if (auditError || (count ?? 0) < 2) {
    throw new Error(`E2E_AUDIT_TRAIL_MISSING:${auditError?.message ?? count ?? 0}`);
  }

  console.log("GMVGANG Auth/RBAC E2E passed");
} finally {
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error("GMVGANG_E2E_CLEANUP_FAILED", { userId, code: error.code });
  }
}
