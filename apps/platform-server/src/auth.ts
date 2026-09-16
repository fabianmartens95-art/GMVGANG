import { parse as parseCookie, serialize as serializeCookie, type SerializeOptions } from "cookie";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAccessTokenPort } from "@gmvgang/platform-api";

export type ResponseMutations = {
  headers: Headers;
};

export type SupabaseCookieAuthOptions = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  production: boolean;
};

function requestCookies(request: Request): Array<{ name: string; value: string }> {
  const parsed = parseCookie(request.headers.get("cookie") ?? "");
  return Object.entries(parsed).map(([name, value]) => ({ name, value }));
}

function cookieHeader(
  name: string,
  value: string,
  options: SerializeOptions,
  production: boolean,
): string {
  return serializeCookie(name, value, {
    ...options,
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: options.path ?? "/",
  });
}

function mergeRefreshHeaders(target: Headers, source: Headers | undefined): void {
  if (!source) return;
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    target.set(key, value);
  }
}

export function createRequestSupabaseClient(
  request: Request,
  mutations: ResponseMutations,
  options: SupabaseCookieAuthOptions,
): SupabaseClient {
  return createServerClient(options.supabaseUrl, options.supabasePublishableKey, {
    cookies: {
      getAll() {
        return requestCookies(request);
      },
      setAll(cookiesToSet, headersToSet) {
        for (const cookie of cookiesToSet) {
          mutations.headers.append(
            "Set-Cookie",
            cookieHeader(cookie.name, cookie.value, cookie.options as SerializeOptions, options.production),
          );
        }
        mergeRefreshHeaders(mutations.headers, headersToSet);
      },
    },
  });
}

export function createCookieAccessTokenPort(client: SupabaseClient): PlatformAccessTokenPort {
  return {
    async getAccessToken() {
      // getSession is used only to extract/refresh the cookie-backed token.
      // The platform authorization path revalidates it with Supabase getUser/getClaims.
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) return null;
      return data.session.access_token;
    },
  };
}

export function applyResponseMutations(response: Response, mutations: ResponseMutations): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of mutations.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") headers.append(key, value);
    else headers.set(key, value);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
