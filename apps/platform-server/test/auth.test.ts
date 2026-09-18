import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlatformAuditEventInput, PlatformAuditLogger } from "../src/audit.js";
import type { PlatformServerConfig } from "../src/env.js";
import { createFixedWindowRateLimiter } from "../src/rate-limit.js";
import { authResponse } from "../src/server.js";

import {
  createCookieAccessTokenPort,
  ensureInitializedSignOut,
  passwordRecoveryRedirect,
} from "../src/auth.js";

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


describe("password recovery redirect", () => {
  it("returns to the authenticated password page after the provider callback", () => {
    const redirect = new URL(passwordRecoveryRedirect("https://app.gmvgang.de"));
    expect(redirect.origin).toBe("https://app.gmvgang.de");
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/account/password?recovery=1");
  });
});


function passwordRecoveryRequest(email = "creator@example.com", origin = "https://app.gmvgang.de"): Request {
  return new Request("https://app.gmvgang.de/api/auth/password-recovery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({ email }),
  });
}

function passwordRecoveryClient(providerError: unknown = null) {
  const calls: Array<{ email: string; redirectTo: string | undefined }> = [];
  const client = {
    auth: {
      async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
        calls.push({ email, redirectTo: options?.redirectTo });
        return { data: {}, error: providerError };
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

function collectingAudit() {
  const events: PlatformAuditEventInput[] = [];
  const audit: PlatformAuditLogger = {
    async record(input) {
      events.push(input);
    },
  };
  return { audit, events };
}

const AUTH_CONFIG = {
  publicOrigin: "https://app.gmvgang.de",
} as PlatformServerConfig;

describe("password recovery route security", () => {
  it("rejects cross-origin requests before contacting the provider", async () => {
    const provider = passwordRecoveryClient();
    const audit = collectingAudit();
    const response = await authResponse(
      passwordRecoveryRequest("creator@example.com", "https://evil.example"),
      provider.client,
      AUTH_CONFIG,
      createFixedWindowRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }),
      audit.audit,
      "req_recovery_origin",
    );

    expect(response?.status).toBe(403);
    expect(provider.calls).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it("keeps valid recovery responses non-enumerating when the provider reports an error", async () => {
    const provider = passwordRecoveryClient({ message: "user_not_found" });
    const audit = collectingAudit();
    const response = await authResponse(
      passwordRecoveryRequest(),
      provider.client,
      AUTH_CONFIG,
      createFixedWindowRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }),
      audit.audit,
      "req_recovery_non_enum",
    );

    expect(response?.status).toBe(202);
    await expect(response?.json()).resolves.toEqual({ ok: true });
    expect(provider.calls).toEqual([{
      email: "creator@example.com",
      redirectTo: "https://app.gmvgang.de/auth/callback?next=%2Faccount%2Fpassword%3Frecovery%3D1",
    }]);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.event).toBe("auth.password_recovery.request_failed");
    expect(JSON.stringify(audit.events)).not.toContain("creator@example.com");
  });

  it("rate-limits repeated recovery requests without writing PII to audit events", async () => {
    const provider = passwordRecoveryClient();
    const audit = collectingAudit();
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 15 * 60 * 1000 });

    const first = await authResponse(
      passwordRecoveryRequest("creator@example.com"),
      provider.client,
      AUTH_CONFIG,
      limiter,
      audit.audit,
      "req_recovery_first",
    );
    const second = await authResponse(
      passwordRecoveryRequest("creator@example.com"),
      provider.client,
      AUTH_CONFIG,
      limiter,
      audit.audit,
      "req_recovery_second",
    );

    expect(first?.status).toBe(202);
    expect(second?.status).toBe(429);
    expect(second?.headers.get("Retry-After")).toBe("900");
    expect(provider.calls).toHaveLength(1);
    expect(audit.events.map((event) => event.event)).toEqual([
      "auth.password_recovery.requested",
      "auth.password_recovery.rate_limited",
    ]);
    expect(JSON.stringify(audit.events)).not.toContain("creator@example.com");
  });
});
