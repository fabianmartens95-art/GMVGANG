import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { completeAuthCallback, renderLogin, safeNextPath } from "../src/auth.js";

describe("safeNextPath", () => {
  it("allows local paths with query parameters", () => {
    expect(safeNextPath("/join?ref=ABC123")).toBe("/join?ref=ABC123");
  });

  it("blocks absolute, protocol-relative and backslash redirects", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/join");
    expect(safeNextPath("//evil.example/steal")).toBe("/join");
    expect(safeNextPath("/\\evil.example/steal")).toBe("/join");
  });
});

describe("login rendering", () => {
  it("fails closed when public Supabase config is missing", () => {
    const html = renderLogin(false, "/join");
    expect(html).toContain("Login noch nicht aktiviert");
    expect(html).not.toContain("magic-link-form");
  });

  it("escapes the next path in form markup", () => {
    const html = renderLogin(true, `/join?ref=ABC123\"><script>`);
    expect(html).toContain("magic-link-form");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("completeAuthCallback", () => {
  it("exchanges a PKCE code and returns only a safe next path", async () => {
    let capturedCode = "";
    const client = {
      auth: {
        async exchangeCodeForSession(code: string) {
          capturedCode = code;
          return { data: { session: null, user: null }, error: null };
        },
      },
    } as unknown as SupabaseClient;

    const result = await completeAuthCallback(
      client,
      new URL("https://app.gmvgang.de/auth/callback?code=abc123&next=https://evil.example"),
    );
    expect(capturedCode).toBe("abc123");
    expect(result).toEqual({ ok: true, nextPath: "/join" });
  });

  it("rejects callbacks without authentication credentials", async () => {
    const client = { auth: {} } as unknown as SupabaseClient;
    await expect(
      completeAuthCallback(client, new URL("https://app.gmvgang.de/auth/callback?next=/join")),
    ).resolves.toEqual({ ok: false, reason: "missing_credentials" });
  });
});
