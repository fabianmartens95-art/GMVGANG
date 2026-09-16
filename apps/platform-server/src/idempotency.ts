import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  PlatformIdempotencyBeginResult,
  PlatformIdempotencyPort,
} from "@gmvgang/platform-api";

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

export function createSupabaseIdempotencyClient(input: {
  url: string;
  serviceRoleKey: string;
}): SupabaseClient {
  return createClient(input.url, input.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export class SupabasePlatformIdempotencyPort implements PlatformIdempotencyPort {
  constructor(private readonly client: SupabaseClient) {}

  async begin(input: {
    scope: string;
    subject: string;
    key: string;
    requestHash: string;
    now: string;
  }): Promise<PlatformIdempotencyBeginResult> {
    const expiresAt = new Date(Date.parse(input.now) + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await this.client.from("mutation_idempotency").insert({
      scope: input.scope,
      subject: input.subject,
      idempotency_key: input.key,
      request_hash: input.requestHash,
      state: "pending",
      created_at: input.now,
      expires_at: expiresAt,
    });

    if (!error) return { status: "started" };
    if (error.code !== "23505") throw new Error(`IDEMPOTENCY_BEGIN_FAILED:${error.code ?? "unknown"}`);

    const { data, error: readError } = await this.client
      .from("mutation_idempotency")
      .select("request_hash,state,response_status,response_body")
      .eq("scope", input.scope)
      .eq("subject", input.subject)
      .eq("idempotency_key", input.key)
      .maybeSingle();
    ensureNoError(readError, "IDEMPOTENCY_READ_FAILED");
    if (!data) throw new Error("IDEMPOTENCY_ROW_MISSING");
    if (data.request_hash !== input.requestHash) return { status: "conflict" };
    if (data.state !== "completed") return { status: "in_progress" };
    if (!Number.isInteger(data.response_status)) throw new Error("IDEMPOTENCY_RESPONSE_INVALID");

    return {
      status: "replay",
      responseStatus: data.response_status,
      responseBody: data.response_body,
    };
  }

  async complete(input: {
    scope: string;
    subject: string;
    key: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    now: string;
  }): Promise<void> {
    const { data, error } = await this.client
      .from("mutation_idempotency")
      .update({
        state: "completed",
        response_status: input.responseStatus,
        response_body: input.responseBody,
        completed_at: input.now,
      })
      .eq("scope", input.scope)
      .eq("subject", input.subject)
      .eq("idempotency_key", input.key)
      .eq("request_hash", input.requestHash)
      .eq("state", "pending")
      .select("scope")
      .maybeSingle();
    ensureNoError(error, "IDEMPOTENCY_COMPLETE_FAILED");
    if (!data) throw new Error("IDEMPOTENCY_COMPLETE_CONFLICT");
  }
}
