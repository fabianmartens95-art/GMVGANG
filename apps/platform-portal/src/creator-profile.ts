import type { CreatorProfileCompletionCommand } from "@gmvgang/creator-registration";

export type CreatorPortalProfile = {
  id: string;
  tiktokHandle: string;
  displayName?: string;
  market?: string;
  language?: string;
  niche?: string[];
  networkStatus: "registered" | "profile_complete";
  profileCompletionPercent: number;
  referralCode: string;
};

export type CreatorProfileResult =
  | { ok: true; creatorProfile: CreatorPortalProfile }
  | { ok: false; errors: string[] };

export interface CreatorProfilePort {
  getProfile(): Promise<CreatorProfileResult>;
  saveProfile(input: CreatorProfileCompletionCommand): Promise<CreatorProfileResult>;
}

type CreatorProfileHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type CreatorProfileFetch = (
  input: string,
  init: {
    method: "GET" | "POST";
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<CreatorProfileHttpResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("CREATOR_PROFILE_PAYLOAD_INVALID");
  const cleaned = value.trim();
  return cleaned || undefined;
}

export function parseCreatorProfileResult(payload: unknown): CreatorProfileResult {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") throw new Error("CREATOR_PROFILE_PAYLOAD_INVALID");
  if (!payload.ok) {
    if (!Array.isArray(payload.errors) || !payload.errors.every((error) => typeof error === "string")) {
      throw new Error("CREATOR_PROFILE_ERRORS_INVALID");
    }
    return { ok: false, errors: payload.errors };
  }

  if (!isRecord(payload.creatorProfile)) throw new Error("CREATOR_PROFILE_PAYLOAD_INVALID");
  const profile = payload.creatorProfile;
  if (
    typeof profile.id !== "string" || !profile.id.trim() ||
    typeof profile.tiktokHandle !== "string" || !profile.tiktokHandle.trim() ||
    !["registered", "profile_complete"].includes(String(profile.networkStatus)) ||
    typeof profile.profileCompletionPercent !== "number" || !Number.isFinite(profile.profileCompletionPercent) ||
    profile.profileCompletionPercent < 0 || profile.profileCompletionPercent > 100 ||
    typeof profile.referralCode !== "string" || !profile.referralCode.trim() ||
    (profile.niche !== undefined && (!Array.isArray(profile.niche) || !profile.niche.every((item) => typeof item === "string")))
  ) throw new Error("CREATOR_PROFILE_PAYLOAD_INVALID");

  const displayName = optionalText(profile.displayName);
  const market = optionalText(profile.market);
  const language = optionalText(profile.language);
  const niche = Array.isArray(profile.niche) ? profile.niche.map(String) : undefined;

  return {
    ok: true,
    creatorProfile: {
      id: profile.id,
      tiktokHandle: profile.tiktokHandle,
      ...(displayName ? { displayName } : {}),
      ...(market ? { market } : {}),
      ...(language ? { language } : {}),
      ...(niche ? { niche } : {}),
      networkStatus: profile.networkStatus as "registered" | "profile_complete",
      profileCompletionPercent: profile.profileCompletionPercent,
      referralCode: profile.referralCode,
    },
  };
}

function errorResult(payload: unknown, fallback: string): CreatorProfileResult {
  try {
    const parsed = parseCreatorProfileResult(payload);
    return parsed.ok ? { ok: false, errors: [fallback] } : parsed;
  } catch {
    return { ok: false, errors: [fallback] };
  }
}

export class HttpCreatorProfileAdapter implements CreatorProfilePort {
  constructor(
    private readonly endpoint = "/api/creator/profile",
    private readonly fetchProfile: CreatorProfileFetch = (input, init) => fetch(input, init),
  ) {}

  async getProfile(): Promise<CreatorProfileResult> {
    try {
      const response = await this.fetchProfile(this.endpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) return errorResult(payload, response.status === 404 ? "creator_profile_not_found" : "creator_profile_unavailable");
      return parseCreatorProfileResult(payload);
    } catch {
      return { ok: false, errors: ["creator_profile_unavailable"] };
    }
  }

  async saveProfile(input: CreatorProfileCompletionCommand): Promise<CreatorProfileResult> {
    try {
      const response = await this.fetchProfile(this.endpoint, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) return errorResult(payload, "creator_profile_save_failed");
      return parseCreatorProfileResult(payload);
    } catch {
      return { ok: false, errors: ["creator_profile_save_failed"] };
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

function profileError(code: string): string {
  const labels: Record<string, string> = {
    creator_profile_not_found: "Für diesen Account wurde noch kein Creator-Profil angelegt.",
    creator_profile_unavailable: "Dein Creator-Profil konnte gerade nicht geladen werden.",
    creator_profile_save_failed: "Dein Profil konnte gerade nicht gespeichert werden.",
    invalid_tiktok_handle: "Bitte prüfe deinen TikTok-Username.",
    tiktok_handle_already_registered: "Dieser TikTok-Account ist bereits mit einem anderen GMVGANG-Profil verbunden.",
    display_name_required: "Bitte gib einen Anzeigenamen an.",
    market_required: "Bitte gib deinen Markt an.",
    language_required: "Bitte gib deine Content-Sprache an.",
    niche_required: "Bitte gib mindestens eine Kategorie an.",
    rate_limited: "Zu viele Änderungen in kurzer Zeit. Bitte versuche es später erneut.",
  };
  return labels[code] ?? "Das Creator-Profil konnte nicht verarbeitet werden.";
}

export function renderCreatorProfile(result: CreatorProfileResult): string {
  if (!result.ok) {
    const missing = result.errors.includes("creator_profile_not_found");
    return `<section class="creator-profile-empty">
      <div class="eyebrow">CREATOR PROFILE</div>
      <h2>${missing ? "Noch kein Creator-Profil" : "Profil nicht verfügbar"}</h2>
      <p>${escapeHtml(result.errors.map(profileError).join(" "))}</p>
      ${missing ? '<a href="/join" data-nav class="creator-profile-submit">Creator-Profil anlegen</a>' : ""}
    </section>`;
  }

  const profile = result.creatorProfile;
  return `<section class="creator-profile-shell">
    <div class="creator-profile-summary">
      <div>
        <div class="eyebrow">CREATOR IDENTITY</div>
        <h2>${escapeHtml(profile.displayName ?? `@${profile.tiktokHandle}`)}</h2>
        <p>@${escapeHtml(profile.tiktokHandle)} · ${profile.profileCompletionPercent}% Profilvollständigkeit</p>
      </div>
      <div class="creator-profile-state">
        <span>${escapeHtml(profile.networkStatus.toUpperCase())}</span>
        <code>${escapeHtml(profile.referralCode)}</code>
      </div>
    </div>

    <form id="creator-profile-form" class="creator-profile-form" novalidate>
      <label>
        <span>TikTok Username *</span>
        <input name="tiktokHandle" value="${escapeHtml(profile.tiktokHandle)}" required minlength="2" maxlength="25" autocomplete="off" />
      </label>
      <label>
        <span>Anzeigename *</span>
        <input name="displayName" value="${escapeHtml(profile.displayName ?? "")}" required minlength="2" autocomplete="name" />
      </label>
      <label>
        <span>Markt *</span>
        <input name="market" value="${escapeHtml(profile.market ?? "")}" required placeholder="DE" autocomplete="country" />
      </label>
      <label>
        <span>Content-Sprache *</span>
        <input name="language" value="${escapeHtml(profile.language ?? "")}" required placeholder="de" />
      </label>
      <label class="creator-profile-form__wide">
        <span>Kategorien / Nischen *</span>
        <input name="niche" value="${escapeHtml((profile.niche ?? []).join(", "))}" required placeholder="Beauty, Fashion, Lifestyle" />
        <small>Mehrere Kategorien mit Komma trennen.</small>
      </label>
      <div class="creator-profile-form__actions creator-profile-form__wide">
        <button type="submit" class="creator-profile-submit">Profil speichern</button>
        <div id="creator-profile-result" class="creator-profile-result" aria-live="polite"></div>
      </div>
    </form>

    <aside class="creator-profile-boundary">
      <strong>Operative Daten bleiben geschützt.</strong>
      <span>Diese Profilseite aktualisiert nur deine eigenen Basisdaten. Screening-, Vertrags-, Compliance- und Intake-Status werden im Company OS verwaltet und durch Profiländerungen nicht zurückgesetzt.</span>
    </aside>
  </section>`;
}

export function wireCreatorProfile(port: CreatorProfilePort): void {
  const form = document.querySelector<HTMLFormElement>("#creator-profile-form");
  const result = document.querySelector<HTMLDivElement>("#creator-profile-result");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
    const niche = String(data.get("niche") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const input: CreatorProfileCompletionCommand = {
      tiktokHandle: String(data.get("tiktokHandle") ?? ""),
      displayName: String(data.get("displayName") ?? ""),
      market: String(data.get("market") ?? ""),
      language: String(data.get("language") ?? ""),
      niche,
    };

    if (button) button.disabled = true;
    result.textContent = "Profil wird gespeichert …";
    const response = await port.saveProfile(input);
    if (!response.ok) {
      result.textContent = response.errors.map(profileError).join(" ");
      if (button) button.disabled = false;
      return;
    }

    result.textContent = `Gespeichert · ${response.creatorProfile.profileCompletionPercent}% vollständig`;
    if (button) button.disabled = false;
  });
}
