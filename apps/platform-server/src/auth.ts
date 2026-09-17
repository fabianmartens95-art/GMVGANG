import { parse as parseCookie, serialize as serializeCookie, type SerializeOptions } from "cookie";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAccessTokenPort } from "@gmvgang/platform-api";

export type ResponseMutations = {
  headers: Headers;
  setCookies: string[];
};

export type SupabaseCookieAuthOptions = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  production: boolean;
};

function requestCookies(request: Request): Array<{ name: string; value: string }> {
  const parsed = parseCookie(request.headers.get("cookie") ?? "");
  return Object.entries(parsed).flatMap(([name, value]) =>
    value === undefined ? [] : [{ name, value }],
  );
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

function mergeRefreshHeaders(
  target: Headers,
  source: Headers | Record<string, string> | undefined,
): void {
  if (!source) return;
  const entries: Iterable<[string, string]> = source instanceof Headers
    ? source.entries()
    : Object.entries(source);
  for (const [key, value] of entries) {
    if (key.toLowerCase() === "set-cookie") continue;
    target.set(key, value);
  }
}

function bearerAccessToken(request: Request): string | null | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization === null) return undefined;

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  if (!match) return null;

  const token = match[1]?.trim() ?? "";
  if (!token || token.length > 8192) return null;
  return token;
}

export function ensureInitializedSignOut(client: SupabaseClient): SupabaseClient {
  const signOut = client.auth.signOut.bind(client.auth);
  client.auth.signOut = async (options) => {
    // @supabase/ssr initializes cookie sessions lazily. Hydrate the request
    // session before signOut so the Auth server can revoke the current
    // refresh-token family instead of only clearing browser cookies.
    await client.auth.getSession();
    return signOut(options);
  };
  return client;
}

export function createRequestSupabaseClient(
  request: Request,
  mutations: ResponseMutations,
  options: SupabaseCookieAuthOptions,
): SupabaseClient {
  const client = createServerClient(options.supabaseUrl, options.supabasePublishableKey, {
    cookies: {
      getAll() {
        return requestCookies(request);
      },
      setAll(cookiesToSet, headersToSet) {
        for (const cookie of cookiesToSet) {
          mutations.setCookies.push(
            cookieHeader(cookie.name, cookie.value, cookie.options as SerializeOptions, options.production),
          );
        }
        mergeRefreshHeaders(mutations.headers, headersToSet);
      },
    },
  });

  return ensureInitializedSignOut(client);
}

export function createCookieAccessTokenPort(client: SupabaseClient): PlatformAccessTokenPort {
  return {
    async getAccessToken(request) {
      const bearer = bearerAccessToken(request);
      if (bearer !== undefined) return bearer;

      // getSession is used only to extract/refresh the cookie-backed token.
      // Platform authorization revalidates either token source with Supabase getUser/getClaims.
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.access_token) return null;
      return data.session.access_token;
    },
  };
}

export function applyResponseMutations(response: Response, mutations: ResponseMutations): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of mutations.headers.entries()) headers.set(key, value);
  for (const value of mutations.setCookies) headers.append("Set-Cookie", value);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
