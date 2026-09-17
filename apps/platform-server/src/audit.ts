import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PlatformAuditEventInput = {
  event: string;
  userId?: string | null;
  creatorProfileId?: string | null;
  organizationId?: string | null;
  occurredAt: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export type PlatformAuditLogger = {
  record(input: PlatformAuditEventInput): Promise<void>;
};

type AuditClient = Pick<SupabaseClient, "from">;

export function auditInsertRow(input: PlatformAuditEventInput) {
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  };

  return {
    event: input.event,
    user_id: input.userId ?? null,
    creator_profile_id: input.creatorProfileId ?? null,
    organization_id: input.organizationId ?? null,
    occurred_at: input.occurredAt,
    metadata,
  };
}

export function createPlatformAuditLogger(config: {
  url: string;
  serviceRoleKey: string;
}): PlatformAuditLogger {
  const client: AuditClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    async record(input) {
      const { error } = await client.from("platform_audit_events").insert(auditInsertRow(input));
      if (error) throw new Error(`AUDIT_INSERT_FAILED:${error.code ?? "unknown"}`);
    },
  };
}

export async function recordAuditBestEffort(
  logger: PlatformAuditLogger,
  input: PlatformAuditEventInput,
): Promise<void> {
  try {
    await logger.record(input);
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "AUDIT_INSERT_FAILED";
    console.error("GMVGANG_AUDIT_WRITE_FAILED", {
      event: input.event,
      requestId: input.requestId ?? null,
      code,
    });
  }
}
