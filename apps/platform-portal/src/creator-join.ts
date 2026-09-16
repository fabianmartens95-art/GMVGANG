import type { PublicCreatorRegistrationInput } from "@gmvgang/creator-registration";
import type { PortalSession } from "./session.js";

export type CreatorRegistrationClientProfile = {
  id: string;
  tiktokHandle: string;
  networkStatus: "registered" | "profile_complete";
  profileCompletionPercent: number;
  referralCode: string;
};

export type CreatorRegistrationClientResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      created: boolean;
      creatorProfile: CreatorRegistrationClientProfile;
      referral: { status: "none" | "attributed" | "duplicate" } | { status: "review"; flags: string[] } | { status: "rejected"; reason: string };
    };

export interface CreatorRegistrationPort {
  register(input: PublicCreatorRegistrationInput): Promise<CreatorRegistrationClientResult>;
}

export type RegistrationHttpResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type RegistrationFetch = (
  input: string,
  init: {
    method: "POST";
    credentials: "include";
    cache: "no-store";
    headers: { Accept: "application/json"; "Content-Type": "application/json" };
    body: string;
  },
) => Promise<RegistrationHttpResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReferral(value: unknown): CreatorRegistrationClientResult extends { ok: true; referral: infer T } ? T : never {
  if (!isRecord(value) || typeof value.status !== "string") throw new Error("REGISTRATION_REFERRAL_INVALID");
  if (["none", "attributed", "duplicate"].includes(value.status)) {
    return { status: value.status } as never;
  }
  if (value.status === "review" && Array.isArray(value.flags) && value.flags.every((flag) => typeof flag === "string")) {
    return { status: "review", flags: value.flags } as never;
  }
  if (value.status === "rejected" && typeof value.reason === "string") {
    return { status: "rejected", reason: value.reason } as never;
  }
  throw new Error("REGISTRATION_REFERRAL_INVALID");
}

export function parseCreatorRegistrationResult(payload: unknown): CreatorRegistrationClientResult {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") throw new Error("REGISTRATION_PAYLOAD_INVALID");

  if (!payload.ok) {
    if (!Array.isArray(payload.errors) || !payload.errors.every((error) => typeof error === "string")) {
      throw new Error("REGISTRATION_ERRORS_INVALID");
    }
    return { ok: false, errors: payload.errors };
  }

  if (!isRecord(payload.creatorProfile) || typeof payload.created !== "boolean") {
    throw new Error("REGISTRATION_PROFILE_INVALID");
  }

  const profile = payload.creatorProfile;
  if (
    typeof profile.id !== "string" ||
    typeof profile.tiktokHandle !== "string" ||
    !["registered", "profile_complete"].includes(String(profile.networkStatus)) ||
    typeof profile.profileCompletionPercent !== "number" ||
    !Number.isFinite(profile.profileCompletionPercent) ||
    profile.profileCompletionPercent < 0 ||
    profile.profileCompletionPercent > 100 ||
    typeof profile.referralCode !== "string"
  ) {
    throw new Error("REGISTRATION_PROFILE_INVALID");
  }

  return {
    ok: true,
    created: payload.created,
    creatorProfile: {
      id: profile.id,
      tiktokHandle: profile.tiktokHandle,
      networkStatus: profile.networkStatus as "registered" | "profile_complete",
      profileCompletionPercent: profile.profileCompletionPercent,
      referralCode: profile.referralCode,
    },
    referral: parseReferral(payload.referral),
  };
}

export class HttpCreatorRegistrationAdapter implements CreatorRegistrationPort {
  constructor(
    private readonly endpoint = "/api/creator/registration",
    private readonly fetchRegistration: RegistrationFetch = (input, init) => fetch(input, init),
  ) {}

  async register(input: PublicCreatorRegistrationInput): Promise<CreatorRegistrationClientResult> {
    try {
      const response = await this.fetchRegistration(this.endpoint, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) return { ok: false, errors: ["registration_unavailable"] };
      return parseCreatorRegistrationResult(await response.json());
    } catch {
      return { ok: false, errors: ["registration_unavailable"] };
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderCreatorJoin(
  session: PortalSession,
  options: { privacyNoticeVersion: string; referralCode?: string },
): string {
  if (session.status !== "authenticated") {
    const referralCode = options.referralCode?.trim().toUpperCase() ?? "";
    const nextPath = referralCode ? `/join?ref=${encodeURIComponent(referralCode)}` : "/join";
    return `
      <main class="join-page">
        <section class="join-shell join-shell--gate">
          <div class="eyebrow">CREATOR REGISTRATION</div>
          <h1>Creator Account erforderlich</h1>
          <p>Melde dich zuerst mit einem verifizierten GMVGANG Account an. Danach kannst du dein Creator-Profil anlegen; ein vorhandener Referral-Code bleibt über den Login hinweg erhalten.</p>
          <a href="/login?next=${encodeURIComponent(nextPath)}" data-nav class="join-submit">Einloggen oder Account erstellen</a>
          <div class="join-gate__status"><span></span>SUPABASE AUTH · SERVER VERIFIED</div>
        </section>
      </main>`;
  }

  if (!options.privacyNoticeVersion.trim()) {
    return `
      <main class="join-page">
        <section class="join-shell join-shell--gate">
          <div class="eyebrow">CREATOR REGISTRATION</div>
          <h1>Registrierung noch nicht freigegeben</h1>
          <p>Für Production ist noch keine Privacy-Notice-Version konfiguriert. Das Formular bleibt fail-closed und nimmt keine Registrierung an.</p>
        </section>
      </main>`;
  }

  const referralCode = options.referralCode?.trim().toUpperCase() ?? "";
  return `
    <main class="join-page">
      <section class="join-shell">
        <div class="join-shell__intro">
          <div class="eyebrow">JOIN GMVGANG</div>
          <h1>Creator Profil starten</h1>
          <p>Registriere deinen TikTok-Account. Ein Portal-Account ist noch keine automatische Aufnahme ins vertragliche GMVGANG Creator Network.</p>
        </div>
        <form id="creator-registration-form" class="join-form" novalidate>
          <label>
            <span>TikTok Username *</span>
            <input name="tiktokHandle" autocomplete="off" placeholder="@deinhandle" required minlength="2" maxlength="25" />
          </label>
          <label>
            <span>Anzeigename</span>
            <input name="displayName" autocomplete="name" placeholder="Dein Name" minlength="2" />
          </label>
          <label>
            <span>Referral Code</span>
            <input name="referralCode" value="${escapeHtml(referralCode)}" autocomplete="off" placeholder="Optional" ${referralCode ? "readonly" : ""} />
          </label>
          <label class="join-check">
            <input type="checkbox" name="ageConfirmed" required />
            <span>Ich bestätige, dass ich mindestens 18 Jahre alt bin.</span>
          </label>
          <label class="join-check">
            <input type="checkbox" name="privacyAccepted" required />
            <span>Ich akzeptiere die für diese Registrierung konfigurierte Datenschutzhinweis-Version.</span>
          </label>
          <input type="hidden" name="privacyNoticeVersion" value="${escapeHtml(options.privacyNoticeVersion)}" />
          <button type="submit" class="join-submit">Creator Profil anlegen</button>
          <div id="creator-registration-result" class="join-result" aria-live="polite"></div>
        </form>
      </section>
    </main>`;
}

function errorMessage(code: string): string {
  const labels: Record<string, string> = {
    age_confirmation_required: "Bitte bestätige, dass du mindestens 18 Jahre alt bist.",
    privacy_acceptance_required: "Bitte bestätige den Datenschutzhinweis.",
    invalid_tiktok_handle: "Bitte prüfe deinen TikTok-Username.",
    tiktok_handle_already_registered: "Dieser TikTok-Account ist bereits registriert.",
    creator_account_already_registered: "Für diesen Account besteht bereits ein Creator-Profil.",
    invalid_referral_code: "Der Referral-Code ist ungültig.",
    registration_unavailable: "Die Registrierung ist aktuell noch nicht serverseitig verfügbar.",
  };
  return labels[code] ?? "Die Registrierung konnte nicht abgeschlossen werden.";
}

export function wireCreatorJoin(port: CreatorRegistrationPort): void {
  const form = document.querySelector<HTMLFormElement>("#creator-registration-form");
  const result = document.querySelector<HTMLDivElement>("#creator-registration-result");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (button) button.disabled = true;
    result.textContent = "Registrierung wird geprüft …";

    const displayName = String(data.get("displayName") ?? "").trim();
    const referralCode = String(data.get("referralCode") ?? "").trim();
    const input: PublicCreatorRegistrationInput = {
      tiktokHandle: String(data.get("tiktokHandle") ?? ""),
      ageConfirmed: data.get("ageConfirmed") === "on",
      privacyAccepted: data.get("privacyAccepted") === "on",
      privacyNoticeVersion: String(data.get("privacyNoticeVersion") ?? ""),
      ...(displayName ? { displayName } : {}),
      ...(referralCode ? { referralCode } : {}),
    };

    const response = await port.register(input);
    if (!response.ok) {
      result.textContent = response.errors.map(errorMessage).join(" ");
      if (button) button.disabled = false;
      return;
    }

    result.innerHTML = `<strong>Profil angelegt.</strong> Profilstatus: ${response.creatorProfile.profileCompletionPercent}% · Dein Referral-Code: <code>${escapeHtml(response.creatorProfile.referralCode)}</code> · <a href="/creator">Creator Portal öffnen →</a>`;
  });
}
