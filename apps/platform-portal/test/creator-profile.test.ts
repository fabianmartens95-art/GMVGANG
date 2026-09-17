import { describe, expect, it } from "vitest";

import {
  HttpCreatorProfileAdapter,
  parseCreatorProfileResult,
  renderCreatorProfile,
  type CreatorProfileFetch,
} from "../src/creator-profile.js";

const PROFILE_PAYLOAD = {
  ok: true,
  creatorProfile: {
    id: "creator-profile-1",
    tiktokHandle: "creator.one",
    displayName: "Creator One",
    market: "DE",
    language: "de",
    niche: ["beauty", "fashion"],
    networkStatus: "profile_complete",
    profileCompletionPercent: 100,
    referralCode: "GMVABC123",
  },
};

function response(status: number, payload: unknown): Awaited<ReturnType<CreatorProfileFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

describe("parseCreatorProfileResult", () => {
  it("accepts the public Creator profile contract without private identity fields", () => {
    expect(parseCreatorProfileResult(PROFILE_PAYLOAD)).toEqual(PROFILE_PAYLOAD);
  });

  it("rejects invalid completion values", () => {
    expect(() => parseCreatorProfileResult({
      ...PROFILE_PAYLOAD,
      creatorProfile: { ...PROFILE_PAYLOAD.creatorProfile, profileCompletionPercent: 101 },
    })).toThrow("CREATOR_PROFILE_PAYLOAD_INVALID");
  });
});

describe("HttpCreatorProfileAdapter", () => {
  it("reads the authenticated profile with same-origin credentials and no-store", async () => {
    let capturedInput = "";
    let capturedInit: unknown;
    const fetcher: CreatorProfileFetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return response(200, PROFILE_PAYLOAD);
    };
    const adapter = new HttpCreatorProfileAdapter("/api/creator/profile", fetcher);

    await expect(adapter.getProfile()).resolves.toEqual(PROFILE_PAYLOAD);
    expect(capturedInput).toBe("/api/creator/profile");
    expect(capturedInit).toEqual({
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("writes only the profile completion command and no client user id", async () => {
    let body = "";
    const fetcher: CreatorProfileFetch = async (_input, init) => {
      body = init.body ?? "";
      return response(200, PROFILE_PAYLOAD);
    };
    const adapter = new HttpCreatorProfileAdapter("/api/creator/profile", fetcher);

    await adapter.saveProfile({
      tiktokHandle: "creator.one",
      displayName: "Creator One",
      market: "DE",
      language: "de",
      niche: ["beauty", "fashion"],
    });

    expect(JSON.parse(body)).toEqual({
      tiktokHandle: "creator.one",
      displayName: "Creator One",
      market: "DE",
      language: "de",
      niche: ["beauty", "fashion"],
    });
    expect(body).not.toContain("userId");
  });

  it("preserves server error codes for actionable UI feedback", async () => {
    const fetcher: CreatorProfileFetch = async () => response(409, {
      ok: false,
      errors: ["tiktok_handle_already_registered"],
    });
    const adapter = new HttpCreatorProfileAdapter("/api/creator/profile", fetcher);

    await expect(adapter.saveProfile({
      tiktokHandle: "duplicate",
      displayName: "Creator One",
      market: "DE",
      language: "de",
      niche: ["beauty"],
    })).resolves.toEqual({ ok: false, errors: ["tiktok_handle_already_registered"] });
  });
});

describe("renderCreatorProfile", () => {
  it("renders a prefilled form and immutable operational boundary notice", () => {
    const html = renderCreatorProfile(parseCreatorProfileResult(PROFILE_PAYLOAD));
    expect(html).toContain('value="creator.one"');
    expect(html).toContain('value="Creator One"');
    expect(html).toContain("GMVABC123");
    expect(html).toContain("Screening-, Vertrags-, Compliance- und Intake-Status");
  });

  it("locks verified identity and matching fields while keeping the display name editable", () => {
    const html = renderCreatorProfile(parseCreatorProfileResult(PROFILE_PAYLOAD));
    expect(html.match(/readonly aria-readonly="true"/g)).toHaveLength(4);
    expect(html).toContain('name="displayName" value="Creator One" required minlength="2" autocomplete="name" />');
    expect(html).toContain("Anzeigename speichern");
    expect(html).toContain("Verifizierte Profildaten sind geschützt.");
    expect(html).toContain("Änderung nur über GMVGANG Review");
  });

  it("shows a join path when no profile exists", () => {
    const html = renderCreatorProfile({ ok: false, errors: ["creator_profile_not_found"] });
    expect(html).toContain("Noch kein Creator-Profil");
    expect(html).toContain('href="/join"');
  });
});
