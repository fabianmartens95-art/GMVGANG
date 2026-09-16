import { createServerClient } from "@supabase/ssr";
import type { PlatformAccessTokenPort } from "@gmvgang/platform-api";

export type RuntimeCookieOptions = {
  domain?: string;
  expires?: Date | string;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

export type RuntimeCookie = {
  name: string;
  value: string;
  options?: RuntimeCookieOptions;
};

export type SupabaseCookieTransportConfig = {
  url: string;
  publishableKey: string;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseCookieHeader(header: string | undefined): Array<{ name: string; value: string }> {
  if (!header?.trim()) return [];
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return [];
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1);
      return name ? [{ name: safeDecode(name), value: safeDecode(value) }] : [];
    });
}

function sameSiteValue(value: RuntimeCookieOptions["sameSite"]): string | null {
  if (value === true) return "Strict";
  if (value === false || value === undefined) return null;
  if (value === "lax") return "Lax";
  if (value === "strict") return "Strict";
  if (value === "none") return "None";
  return null;
}

export function serializeRuntimeCookie(cookie: RuntimeCookie): string {
  const options = cookie.options ?? {};
  const parts = [`${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) {
    const expires = options.expires instanceof Date ? options.expires : new Date(options.expires);
    if (Number.isFinite(expires.getTime())) parts.push(`Expires=${expires.toUTCString()}`);
  }
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  const sameSite = sameSiteValue(options.sameSite);
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}

export function createSupabaseCookieAccessTokenPort(
  config: SupabaseCookieTransportConfig,
  cookieHeader: string | undefined,
  onSetCookies: (cookies: RuntimeCookie[]) => void,
): PlatformAccessTokenPort {
  const client = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet) {
        onSetCookies(cookiesToSet as RuntimeCookie[]);
      },
    },
  });

  return {
    async getAccessToken() {
      // getSession() is used only to extract/refresh the cookie-backed token.
      // Authorization is performed downstream by resolveSupabasePlatformSessionContext(),
      // which re-verifies the token against Supabase before roles/tenants are resolved.
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) return null;
      return data.session.access_token;
    },
  };
}
