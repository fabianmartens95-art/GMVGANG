import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createCookieAccessTokenPort, ensureInitializedSignOut } from "../src/auth.js";

function fakeClient(options?: { token?: string | null; error?: boolean }) {
  let sessionReads = 0;
  const client = {
    auth: {
      async getSession() {
        sessionReads += 1;
        if (options?.error) return { data: { session: null }, error: { message: "failed" } };
        return {
          data: {
            session: options?.token === null
              ? null
              : { access_token: options?.token ?? "cookie-access-token" },
          },
          error: null,
        };
      },
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    sessionReads: () => sessionReads,
  };
}

describe("platform access-token extraction", () => {
  it("prefers an explicit Bearer token and leaves the cookie session untouched", async () => {
    const fake = fakeClient();
    const port = createCookieAccessTokenPort(fake.client);
    const request = new Request("https://app.gmvgang.de/api/session", {
      headers: { Authorization: "Bearer mobile-access-token" },
    });

    await expect(port.getAccessToken(request)).resolves.toBe("mobile-access-token");
    expect(fake.sessionReads()).toBe(0);
  });

  it("accepts Bearer scheme case-insensitively", async () => {
    const fake = fakeClient();
    const port = createCookieAccessTokenPort(fake.client);
    const request = new Request("https://app.gmvgang.de/api/session", {
      headers: { Authorization: "bearer token-123" },
    });

    await expect(port.getAccessToken(request)).resolves.toBe("token-123");
    expect(fake.sessionReads()).toBe(0);
  });

  it("fails closed on a malformed Authorization header instead of falling back to cookies", async () => {
    const fake = fakeClient();
    const port = createCookieAccessTokenPort(fake.client);
    const request = new Request("https://app.gmvgang.de/api/session", {
      headers: { Authorization: "Basic abc123" },
    });

    await expect(port.getAccessToken(request)).resolves.toBeNull();
    expect(fake.sessionReads()).toBe(0);
  });

  it("falls back to the cookie-backed Supabase session when Authorization is absent", async () => {
    const fake = fakeClient({ token: "cookie-token" });
    const port = createCookieAccessTokenPort(fake.client);
    const request = new Request("https://app.gmvgang.de/api/session");

    await expect(port.getAccessToken(request)).resolves.toBe("cookie-token");
    expect(fake.sessionReads()).toBe(1);
  });

  it("returns null when no valid cookie-backed session exists", async () => {
    const fake = fakeClient({ token: null });
    const port = createCookieAccessTokenPort(fake.client);

    await expect(port.getAccessToken(new Request("https://app.gmvgang.de/api/session"))).resolves.toBeNull();
    expect(fake.sessionReads()).toBe(1);
  });
});

describe("SSR sign-out", () => {
  it("hydrates the lazy cookie session before revoking the current session", async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        async getSession() {
          calls.push("getSession");
          return { data: { session: { access_token: "access", refresh_token: "refresh" } }, error: null };
        },
        async signOut(options?: { scope?: string }) {
          calls.push(`signOut:${options?.scope ?? "default"}`);
          return { error: null };
        },
      },
    } as unknown as SupabaseClient;

    const initialized = ensureInitializedSignOut(client);
    await initialized.auth.signOut({ scope: "local" });

    expect(calls).toEqual(["getSession", "signOut:local"]);
  });
});
