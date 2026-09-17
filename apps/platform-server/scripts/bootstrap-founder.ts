import { createClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function projectRef(url: string): string {
  const hostname = new URL(url).hostname;
  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname);
  if (!match?.[1]) throw new Error("SUPABASE_PROJECT_REF_INVALID");
  return match[1];
}

const supabaseUrl = required("SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const expectedProjectRef = required("FOUNDER_EXPECTED_PROJECT_REF");
const userId = required("FOUNDER_AUTH_USER_ID");
const confirmation = required("FOUNDER_BOOTSTRAP_CONFIRM");

if (!UUID.test(userId)) throw new Error("FOUNDER_AUTH_USER_ID_INVALID");
if (projectRef(supabaseUrl) !== expectedProjectRef) throw new Error("FOUNDER_PROJECT_REF_MISMATCH");
if (confirmation !== `BOOTSTRAP:${expectedProjectRef}:${userId}`) {
  throw new Error("FOUNDER_BOOTSTRAP_CONFIRM_INVALID");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const [{ data: authUser, error: authError }, platformUserResult, organizationResult, founderResult] =
  await Promise.all([
    client.auth.admin.getUserById(userId),
    client.from("platform_users").select("id,status").eq("id", userId).maybeSingle(),
    client.from("organizations").select("id,type,status").eq("type", "gmvgang").eq("status", "active").limit(2),
    client.from("memberships").select("id,user_id,organization_id,status").eq("role", "founder"),
  ]);

if (authError || !authUser.user) throw new Error("FOUNDER_AUTH_USER_NOT_FOUND");
if (platformUserResult.error) {
  throw new Error(`FOUNDER_PLATFORM_USER_QUERY_FAILED:${platformUserResult.error.code ?? "unknown"}`);
}
if (!platformUserResult.data || platformUserResult.data.status !== "active") {
  throw new Error("FOUNDER_PLATFORM_USER_NOT_ACTIVE");
}
if (organizationResult.error) {
  throw new Error(`FOUNDER_ORGANIZATION_QUERY_FAILED:${organizationResult.error.code ?? "unknown"}`);
}
if (!organizationResult.data || organizationResult.data.length !== 1 || !organizationResult.data[0]?.id) {
  throw new Error("FOUNDER_GMVGANG_ORGANIZATION_INVALID");
}
if (founderResult.error) {
  throw new Error(`FOUNDER_MEMBERSHIP_QUERY_FAILED:${founderResult.error.code ?? "unknown"}`);
}

const organizationId = organizationResult.data[0].id;
const founderRows = founderResult.data ?? [];
const activeFounder = founderRows.find((row) => row.status === "active");

if (activeFounder) {
  if (activeFounder.user_id !== userId || activeFounder.organization_id !== organizationId) {
    throw new Error("FOUNDER_ALREADY_BOOTSTRAPPED_TO_ANOTHER_USER");
  }
  console.log("GMVGANG founder already bootstrapped for the requested user.");
  process.exit(0);
}

const existingTarget = founderRows.find(
  (row) => row.user_id === userId && row.organization_id === organizationId,
);
const now = new Date().toISOString();

if (existingTarget?.id) {
  const { error } = await client
    .from("memberships")
    .update({ status: "active", updated_at: now })
    .eq("id", existingTarget.id)
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("role", "founder");
  if (error) throw new Error(`FOUNDER_MEMBERSHIP_UPDATE_FAILED:${error.code ?? "unknown"}`);
} else {
  const { error } = await client.from("memberships").insert({
    user_id: userId,
    organization_id: organizationId,
    role: "founder",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`FOUNDER_MEMBERSHIP_INSERT_FAILED:${error.code ?? "unknown"}`);
}

const { error: auditError } = await client.from("platform_audit_events").insert({
  event: "membership.founder_bootstrapped",
  user_id: userId,
  organization_id: organizationId,
  occurred_at: now,
  metadata: { source: "explicit_founder_bootstrap" },
});
if (auditError) throw new Error(`FOUNDER_AUDIT_INSERT_FAILED:${auditError.code ?? "unknown"}`);

const { data: verified, error: verifyError } = await client
  .from("memberships")
  .select("id")
  .eq("user_id", userId)
  .eq("organization_id", organizationId)
  .eq("role", "founder")
  .eq("status", "active")
  .maybeSingle();

if (verifyError || !verified?.id) throw new Error("FOUNDER_BOOTSTRAP_VERIFY_FAILED");

console.log("GMVGANG founder bootstrap verified.");
