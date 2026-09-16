import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseRequestConfig = {
  url: string;
  publishableKey: string;
};

function required(value: string, code: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function appendSetCookie(response: ServerResponse, cookie: string): void {
  const current = response.getHeader("Set-Cookie");
  if (!current) {
    response.setHeader("Set-Cookie", [cookie]);
    return;
  }
  if (Array.isArray(current)) {
    response.setHeader("Set-Cookie", [...current.map(String), cookie]);
    return;
  }
  response.setHeader("Set-Cookie", [String(current), cookie]);
}

function applyHeaders(response: ServerResponse, headers: Record<string, string> | undefined): void {
  if (!headers) return;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "set-cookie") continue;
    response.setHeader(name, value);
  }
}

export function createRequestSupabaseClient(
  request: IncomingMessage,
  response: ServerResponse,
  config: SupabaseRequestConfig,
): SupabaseClient {
  const url = required(config.url, "SUPABASE_URL_REQUIRED");
  const publishableKey = required(config.publishableKey, "SUPABASE_PUBLISHABLE_KEY_REQUIRED");

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.cookie ?? "");
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          appendSetCookie(
            response,
            serializeCookieHeader(cookie.name, cookie.value, cookie.options as CookieOptions),
          );
        }
        applyHeaders(response, headers as Record<string, string> | undefined);
      },
    },
  });
}

export async function requestAccessToken(client: SupabaseClient): Promise<string | null> {
  const claimsResult = await client.auth.getClaims();
  if (claimsResult.error || !claimsResult.data?.claims) return null;

  const sessionResult = await client.auth.getSession();
  if (sessionResult.error || !sessionResult.data.session?.access_token) return null;
  return sessionResult.data.session.access_token;
}
