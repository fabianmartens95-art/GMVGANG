import type { CreatorProfileCompletionCommand } from "@gmvgang/creator-registration";
import {
  CREATOR_NETWORK_STATUSES,
  creatorNetworkStatusPresentation,
  type CreatorPortalNetworkStatus,
} from "./creator-status.js";

export type { CreatorPortalNetworkStatus } from "./creator-status.js";

export type CreatorPortalProfile = {
  id: string;
  tiktokHandle: string;
  displayName?: string;
  market?: string;
  language?: string;
  niche?: string[];
  networkStatus: CreatorPortalNetworkStatus;
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

type CreatorProfileOption = {
  value: string;
  label: string;
};

const CREATOR_MARKETS: readonly CreatorProfileOption[] = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
  { value: "FR", label: "Frankreich" },
  { value: "IT", label: "Italien" },
  { value: "ES", label: "Spanien" },
  { value: "NL", label: "Niederlande" },
  { value: "BE", label: "Belgien" },
  { value: "PL", label: "Polen" },
  { value: "GB", label: "Vereinigtes Königreich" },
  { value: "IE", label: "Irland" },
  { value: "INT", label: "International / mehrere Märkte" },
];

const CREATOR_LANGUAGES: readonly CreatorProfileOption[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "Englisch" },
  { value: "fr", label: "Französisch" },
  { value: "it", label: "Italienisch" },
  { value: "es", label: "Spanisch" },
  { value: "nl", label: "Niederländisch" },
  { value: "pl", label: "Polnisch" },
  { value: "tr", label: "Türkisch" },
  { value: "ar", label: "Arabisch" },
  { value: "other", label: "Andere Sprache" },
];

const CREATOR_NICHES: readonly CreatorProfileOption[] = [
  { value: "beauty", label: "Beauty" },
  { value: "fashion", label: "Fashion" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "fitness-sport", label: "Fitness & Sport" },
  { value: "food-cooking", label: "Food & Kochen" },
  { value: "home-living", label: "Home & Living" },
  { value: "tech", label: "Tech" },
  { value: "gaming", label: "Gaming" },
  { value: "family-parenting", label: "Familie & Parenting" },
  { value: "health-wellness", label: "Health & Wellness" },
  { value: "travel", label: "Travel" },
  { value: "automotive", label: "Automotive" },
  { value: "pets", label: "Pets" },
  { value: "finance-business", label: "Finance & Business" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "diy-crafts", label: "DIY & Crafts" },
];

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
    !CREATOR_NETWORK_STATUSES.includes(String(profile.networkStatus) as CreatorPortalNetworkStatus) ||
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
      networkStatus: profile.networkStatus as CreatorPortalNetworkStatus,
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

function renderProfileSelectOptions(options: readonly CreatorProfileOption[], currentValue: string | undefined): string {
  const current = currentValue?.trim() ?? "";
  const known = options.some((option) => option.value.toLowerCase() === current.toLowerCase());
  const currentOption = current && !known
    ? [{ value: current, label: `${current} (bestehend)` }]
    : [];

  return [
    '<option value="">Bitte auswählen</option>',
    ...currentOption,
    ...options,
  ].map((option) => {
    if (typeof option === "string") return option;
    const selected = current && option.value.toLowerCase() === current.toLowerCase() ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function renderNicheTags(selectedNiches: readonly string[], disabled: boolean): string {
  const selected = new Set(selectedNiches.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const knownValues = new Set(CREATOR_NICHES.map((option) => option.value.toLowerCase()));
  const legacyOptions = [...selectedNiches.reduce((options, item) => {
    const value = item.trim();
    const key = value.toLowerCase();
    if (value && !knownValues.has(key) && !options.has(key)) {
      options.set(key, { value, label: `${value} (bestehend)` });
    }
    return options;
  }, new Map<string, CreatorProfileOption>()).values()];

  return [...CREATOR_NICHES, ...legacyOptions].map((option) => {
    const checked = selected.has(option.value.toLowerCase()) ? " checked" : "";
    const lock = disabled ? ' disabled aria-disabled="true"' : "";
    return `<label class="creator-profile-tag">
      <input type="checkbox" name="niche" value="${escapeHtml(option.value)}"${checked}${lock} />
      <span>${escapeHtml(option.label)}</span>
    </label>`;
  }).join("");
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
  const networkStatus = creatorNetworkStatusPresentation(profile.networkStatus);
  const verified = profile.networkStatus !== "registered";
  const textLocked = verified ? ' readonly aria-readonly="true"' : "";
  const selectLocked = verified ? ' disabled aria-disabled="true"' : "";
  const verifiedHint = verified ? '<small>Verifiziert · Änderung nur über GMVGANG Review.</small>' : "";
  const selectedNiches = profile.niche ?? [];
  const lockedMarketValue = verified ? `<input type="hidden" name="market" value="${escapeHtml(profile.market ?? "")}" />` : "";
  const lockedLanguageValue = verified ? `<input type="hidden" name="language" value="${escapeHtml(profile.language ?? "")}" />` : "";
  const lockedNicheValues = verified
    ? selectedNiches.map((item) => `<input type="hidden" name="niche" value="${escapeHtml(item)}" />`).join("")
    : "";

  return `<section class="creator-profile-shell">
    <div class="creator-profile-summary">
      <div>
        <div class="eyebrow">CREATOR IDENTITY</div>
        <h2>${escapeHtml(profile.displayName ?? `@${profile.tiktokHandle}`)}</h2>
        <p>@${escapeHtml(profile.tiktokHandle)} · <span id="creator-profile-completion">${profile.profileCompletionPercent}% Profilvollständigkeit</span></p>
      </div>
      <div class="creator-profile-state">
        <span>${escapeHtml(networkStatus.label)}</span>
        <code>${escapeHtml(profile.referralCode)}</code>
      </div>
    </div>

    <progress id="creator-profile-progress" class="creator-profile-progress" value="${profile.profileCompletionPercent}" max="100">${profile.profileCompletionPercent}%</progress>

    <form id="creator-profile-form" class="creator-profile-form" novalidate>
      <label>
        <span>TikTok Username *</span>
        <input name="tiktokHandle" value="${escapeHtml(profile.tiktokHandle)}" required minlength="2" maxlength="25" autocomplete="off"${textLocked} />
        ${verifiedHint}
      </label>
      <label>
        <span>Anzeigename *</span>
        <input name="displayName" value="${escapeHtml(profile.displayName ?? "")}" required minlength="2" autocomplete="name" />
        ${verified ? '<small>Kann von dir selbst aktualisiert werden.</small>' : ""}
      </label>
      <label>
        <span>Markt *</span>
        ${lockedMarketValue}
        <select name="market" required autocomplete="country"${selectLocked}>
          ${renderProfileSelectOptions(CREATOR_MARKETS, profile.market)}
        </select>
        ${verifiedHint}
      </label>
      <label>
        <span>Content-Sprache *</span>
        ${lockedLanguageValue}
        <select name="language" required${selectLocked}>
          ${renderProfileSelectOptions(CREATOR_LANGUAGES, profile.language)}
        </select>
        ${verifiedHint}
      </label>
      <fieldset class="creator-profile-form__wide creator-profile-niches">
        <legend>Kategorien / Nischen *</legend>
        ${lockedNicheValues}
        <div class="creator-profile-tags" role="group" aria-label="Kategorien und Nischen">
          ${renderNicheTags(selectedNiches, verified)}
        </div>
        ${verified ? verifiedHint : "<small>Wähle alle Schlagwörter aus, die zu deinem Content passen.</small>"}
      </fieldset>
      <div class="creator-profile-form__actions creator-profile-form__wide">
        <button type="submit" class="creator-profile-submit">${verified ? "Anzeigename speichern" : "Profil speichern"}</button>
        <div id="creator-profile-result" class="creator-profile-result" aria-live="polite"></div>
      </div>
    </form>

    <aside class="creator-profile-boundary">
      <strong>${verified ? "Verifizierte Profildaten sind geschützt." : "Operative Daten bleiben geschützt."}</strong>
      <span>${verified
        ? "TikTok-Username, Markt, Content-Sprache und Kategorien sind nach Abschluss des Profils gesperrt. Änderungen daran benötigen einen kontrollierten GMVGANG Review. Screening-, Vertrags-, Compliance- und Intake-Status bleiben ebenfalls geschützt."
        : "Diese Profilseite aktualisiert nur deine eigenen Basisdaten. Screening-, Vertrags-, Compliance- und Intake-Status werden im Company OS verwaltet und durch Profiländerungen nicht zurückgesetzt."}</span>
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
    const niche = [...data.getAll("niche").reduce((values, item) => {
      const value = String(item).trim();
      const key = value.toLowerCase();
      if (value && !values.has(key)) values.set(key, value);
      return values;
    }, new Map<string, string>()).values()];

    if (niche.length === 0) {
      result.textContent = "Bitte wähle mindestens eine Kategorie oder Nische aus.";
      return;
    }

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
    const progress = document.querySelector<HTMLProgressElement>("#creator-profile-progress");
    const completion = document.querySelector<HTMLSpanElement>("#creator-profile-completion");
    if (progress) progress.value = response.creatorProfile.profileCompletionPercent;
    if (completion) completion.textContent = `${response.creatorProfile.profileCompletionPercent}% Profilvollständigkeit`;
    if (button) button.disabled = false;
  });
}
