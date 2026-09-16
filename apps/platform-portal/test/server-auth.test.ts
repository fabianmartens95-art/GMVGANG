import { describe, expect, it } from "vitest";

import { parseCookieHeader, serializeRuntimeCookie } from "../server/supabase-auth.js";

describe("Supabase cookie transport", () => {
  it("parses multiple request cookies without truncating encoded values", () => {
    expect(parseCookieHeader("sb-a=base64%2Dvalue; theme=dark; broken")).toEqual([
      { name: "sb-a", value: "base64-value" },
      { name: "theme", value: "dark" },
    ]);
  });

  it("serializes secure cookie attributes", () => {
    expect(serializeRuntimeCookie({
      name: "sb-session",
      value: "token value",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      },
    })).toBe("sb-session=token%20value; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax");
  });

  it("returns no cookies for an empty header", () => {
    expect(parseCookieHeader(undefined)).toEqual([]);
    expect(parseCookieHeader("   ")).toEqual([]);
  });
});
