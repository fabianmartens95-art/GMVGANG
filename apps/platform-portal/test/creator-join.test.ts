import { describe, expect, it } from "vitest";

import { HttpCreatorRegistrationAdapter, parseCreatorRegistrationResult, renderCreatorJoin } from "../src/creator-join.js";

describe("Creator Join", () => {
  it("keeps anonymous users behind the verified-account gate", () => {
    const html = renderCreatorJoin({ status: "anonymous", roles: [] }, { privacyNoticeVersion: "privacy-v1" });
    expect(html).toContain("Creator Account erforderlich");
    expect(html).not.toContain("creator-registration-form");
  });

  it("keeps authenticated registration fail-closed without a privacy version", () => {
    const html = renderCreatorJoin(
      { status: "authenticated", userId: "user-1", roles: [] },
      { privacyNoticeVersion: "" },
    );
    expect(html).toContain("Registrierung noch nicht freigegeben");
    expect(html).not.toContain("creator-registration-form");
  });

  it("renders a referral from the URL only as escaped form data", () => {
    const html = renderCreatorJoin(
      { status: "authenticated", userId: "user-1", roles: [] },
      { privacyNoticeVersion: "privacy-v1", referralCode: `ABC123\"><script>` },
    );
    expect(html).toContain("creator-registration-form");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;SCRIPT&gt;");
  });
});

describe("HttpCreatorRegistrationAdapter", () => {
  it("posts only registration input to the same-origin endpoint with credentials", async () => {
    let capturedBody = "";
    let capturedInit: unknown;
    const adapter = new HttpCreatorRegistrationAdapter("/api/creator/registration", async (_input, init) => {
      capturedBody = init.body;
      capturedInit = init;
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            created: true,
            creatorProfile: {
              id: "creator-1",
              tiktokHandle: "creator.one",
              networkStatus: "registered",
              profileCompletionPercent: 20,
              referralCode: "CREATOR0001",
            },
            referral: { status: "none" },
          };
        },
      };
    });

    await expect(
      adapter.register({
        tiktokHandle: "@creator.one",
        ageConfirmed: true,
        privacyAccepted: true,
        privacyNoticeVersion: "privacy-v1",
      }),
    ).resolves.toMatchObject({ ok: true, created: true });

    expect(JSON.parse(capturedBody)).toEqual({
      tiktokHandle: "@creator.one",
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: "privacy-v1",
    });
    expect(capturedBody).not.toContain("userId");
    expect(capturedInit).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("fails closed on malformed or unavailable responses", async () => {
    expect(() => parseCreatorRegistrationResult({ ok: true })).toThrow("REGISTRATION_PROFILE_INVALID");

    const adapter = new HttpCreatorRegistrationAdapter("/api/creator/registration", async () => ({
      ok: false,
      async json() { return {}; },
    }));
    await expect(adapter.register({
      tiktokHandle: "creator",
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: "privacy-v1",
    })).resolves.toEqual({ ok: false, errors: ["registration_unavailable"] });
  });
});
