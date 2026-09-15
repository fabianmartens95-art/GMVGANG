import {
  calculateProfileCompleteness,
  normalizeReferralCode,
  validateCreatorRegistration,
  type CreatorProfileInput,
  type CreatorRegistrationInput
} from "@gmvgang/creator-growth";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app root not found");

const referralFromUrl = normalizeReferralCode(
  new URLSearchParams(window.location.search).get("ref") ?? undefined
);

app.innerHTML = `
  <main class="page-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="GMVGANG Creator Network">
        <span class="brand-mark">GMV</span><span>GANG</span>
      </a>
      <span class="network-label">CREATOR NETWORK</span>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">CREATORS. BRANDS. SALES.</p>
        <h1>DEIN CREATOR<br/><span>NETWORK.</span></h1>
        <p class="intro">Ein Profil. Passende Brand-Matches. Kampagnen, Samples, Performance und Referrals an einem Ort.</p>
        <div class="benefit-row">
          <article><strong>01</strong><span>PROFIL AUFBAUEN</span></article>
          <article><strong>02</strong><span>MATCHES ERHALTEN</span></article>
          <article><strong>03</strong><span>CREATOR EMPFEHLEN</span></article>
        </div>
      </div>

      <section class="registration-card" aria-labelledby="registration-title">
        <div class="card-head">
          <div>
            <p id="step-label" class="step">STEP 01 / ACCOUNT</p>
            <h2 id="registration-title">CREATOR REGISTRIEREN</h2>
          </div>
          <span class="status-dot" title="Private Beta"></span>
        </div>

        ${referralFromUrl ? `<div class="referral-banner"><span>INVITE CODE</span><strong>${referralFromUrl}</strong></div>` : ""}

        <form id="registration-form" novalidate>
          <label>
            <span>Name</span>
            <input id="display-name" autocomplete="name" placeholder="Dein Name" />
          </label>
          <label>
            <span>TikTok Username</span>
            <input id="tiktok-handle" autocomplete="off" placeholder="@username" />
          </label>
          <label>
            <span>E-Mail</span>
            <input id="email" type="email" autocomplete="email" placeholder="creator@example.com" />
          </label>
          <label class="check-row">
            <input id="age-confirmed" type="checkbox" />
            <span>Ich bin mindestens 18 Jahre alt.</span>
          </label>
          <label class="check-row">
            <input id="privacy-accepted" type="checkbox" />
            <span>Ich akzeptiere die Datenschutzbedingungen.</span>
          </label>
          <input id="referral-code" type="hidden" value="${referralFromUrl ?? ""}" />

          <div id="form-errors" class="form-errors" role="alert" hidden></div>
          <button class="primary-button" type="submit">WEITER ZUM PROFIL <span aria-hidden="true">→</span></button>
          <p class="privacy-note">Diese Preview sendet noch keine personenbezogenen Daten. Der sichere Server-Adapter wird vor Public Launch aktiviert.</p>
        </form>

        <form id="profile-form" novalidate hidden>
          <div class="profile-progress">
            <div><span>PROFILFORTSCHRITT</span><strong id="profile-percent">56%</strong></div>
            <div class="progress-track"><span id="profile-progress-fill"></span></div>
          </div>

          <label>
            <span>Follower</span>
            <input id="follower-count" type="number" inputmode="numeric" min="0" placeholder="z. B. 12500" />
          </label>
          <label>
            <span>Account-Region</span>
            <select id="country-code">
              <option value="">Bitte wählen</option>
              <option value="DE">Deutschland</option>
              <option value="EU">EU (andere)</option>
              <option value="OUTSIDE_EU">Außerhalb EU</option>
            </select>
          </label>
          <fieldset>
            <legend>Deine Hauptkategorien</legend>
            <div class="category-grid">
              ${["Beauty", "Fashion", "Home", "Gaming", "Tech", "Food", "Fitness", "Other"].map((category) => `
                <label class="category-chip">
                  <input type="checkbox" name="category" value="${category}" />
                  <span>${category}</span>
                </label>
              `).join("")}
            </div>
          </fieldset>
          <label>
            <span>Gehst du LIVE?</span>
            <select id="live-creator">
              <option value="">Bitte wählen</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </label>

          <div id="profile-errors" class="form-errors" role="alert" hidden></div>
          <button class="primary-button" type="submit">PROFIL ABSCHLIESSEN <span aria-hidden="true">→</span></button>
          <button id="back-to-account" class="text-button" type="button">← ACCOUNT BEARBEITEN</button>
        </form>

        <div id="success-state" class="success-state" hidden>
          <p class="step">PROFILE COMPLETION / 100%</p>
          <h2>READY FÜR SCREENING.</h2>
          <p>Dein Creator-Profil ist vollständig. Nach Anschluss der sicheren Auth-/Company-OS-Grenze kann dieser Datensatz direkt in die bestehende GMVGANG Creator-SSOT geschrieben und für Matching, Kampagnen und Referrals genutzt werden.</p>
          <div class="ready-grid">
            <span>ACCOUNT <strong>READY</strong></span>
            <span>PROFIL <strong>100%</strong></span>
            <span>SCREENING <strong>PENDING</strong></span>
          </div>
          <button id="reset-form" class="secondary-button" type="button">NEUES PROFIL TESTEN</button>
        </div>
      </section>
    </section>

    <footer>
      <span>GMVGANG CREATOR NETWORK / PRIVATE BETA</span>
      <span>CREATE. CONVERT. SCALE.</span>
    </footer>
  </main>
`;

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

function buildRegistrationInput(): CreatorRegistrationInput {
  const input: CreatorRegistrationInput = {
    displayName: mustQuery<HTMLInputElement>("#display-name").value,
    tiktokHandle: mustQuery<HTMLInputElement>("#tiktok-handle").value,
    email: mustQuery<HTMLInputElement>("#email").value,
    ageConfirmed: mustQuery<HTMLInputElement>("#age-confirmed").checked,
    privacyAccepted: mustQuery<HTMLInputElement>("#privacy-accepted").checked,
  };
  const referralCode = mustQuery<HTMLInputElement>("#referral-code").value;
  if (referralCode) input.referralCode = referralCode;
  return input;
}

let registrationInput: CreatorRegistrationInput | null = null;

function buildProfileInput(): CreatorProfileInput | null {
  if (!registrationInput) return null;
  const profile: CreatorProfileInput = { ...registrationInput };
  const followers = mustQuery<HTMLInputElement>("#follower-count").value;
  const countryCode = mustQuery<HTMLSelectElement>("#country-code").value;
  const liveCreator = mustQuery<HTMLSelectElement>("#live-creator").value;
  const categories = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="category"]:checked')
  ).map((input) => input.value);

  if (followers !== "") profile.followerCount = Number(followers);
  if (countryCode) profile.countryCode = countryCode;
  if (categories.length) profile.primaryCategories = categories;
  if (liveCreator) profile.isLiveCreator = liveCreator === "yes";
  return profile;
}

const errorLabels: Record<string, string> = {
  display_name_required: "Bitte gib deinen Namen an.",
  invalid_tiktok_handle: "Bitte prüfe deinen TikTok Username.",
  invalid_email: "Bitte gib eine gültige E-Mail-Adresse an.",
  age_confirmation_required: "Die Registrierung ist nur ab 18 möglich.",
  privacy_acceptance_required: "Bitte akzeptiere die Datenschutzbedingungen.",
  invalid_referral_code: "Der Referral-Code ist ungültig."
};

const profileFieldLabels: Record<string, string> = {
  followerCount: "Follower",
  countryCode: "Account-Region",
  primaryCategories: "mindestens eine Hauptkategorie",
  isLiveCreator: "LIVE-Status",
};

const registrationForm = mustQuery<HTMLFormElement>("#registration-form");
const profileForm = mustQuery<HTMLFormElement>("#profile-form");
const successState = mustQuery<HTMLElement>("#success-state");
const errorBox = mustQuery<HTMLElement>("#form-errors");
const profileErrorBox = mustQuery<HTMLElement>("#profile-errors");
const title = mustQuery<HTMLElement>("#registration-title");
const stepLabel = mustQuery<HTMLElement>("#step-label");
const percentLabel = mustQuery<HTMLElement>("#profile-percent");
const progressFill = mustQuery<HTMLElement>("#profile-progress-fill");

registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = buildRegistrationInput();
  const result = validateCreatorRegistration(input);

  if (!result.ok) {
    errorBox.hidden = false;
    errorBox.innerHTML = result.errors.map((error) => `<p>${errorLabels[error] ?? error}</p>`).join("");
    return;
  }

  registrationInput = input;
  errorBox.hidden = true;
  errorBox.textContent = "";
  registrationForm.hidden = true;
  profileForm.hidden = false;
  stepLabel.textContent = "STEP 02 / PROFILE";
  title.textContent = "PROFIL VERVOLLSTÄNDIGEN";
  updateProfileProgress();
});

profileForm.addEventListener("input", updateProfileProgress);
profileForm.addEventListener("change", updateProfileProgress);
profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const profile = buildProfileInput();
  if (!profile) return;
  const completeness = calculateProfileCompleteness(profile);

  if (!completeness.complete) {
    const missing = completeness.missingFields
      .filter((field) => profileFieldLabels[field])
      .map((field) => profileFieldLabels[field]);
    profileErrorBox.hidden = false;
    profileErrorBox.innerHTML = `<p>Bitte ergänze: ${missing.join(", ")}.</p>`;
    return;
  }

  profileErrorBox.hidden = true;
  profileForm.hidden = true;
  successState.hidden = false;
  stepLabel.textContent = "COMPLETE";
  title.textContent = "CREATOR PROFIL";
});

mustQuery<HTMLButtonElement>("#back-to-account").addEventListener("click", () => {
  profileForm.hidden = true;
  registrationForm.hidden = false;
  stepLabel.textContent = "STEP 01 / ACCOUNT";
  title.textContent = "CREATOR REGISTRIEREN";
});

mustQuery<HTMLButtonElement>("#reset-form").addEventListener("click", () => {
  registrationInput = null;
  mustQuery<HTMLFormElement>("#registration-form").reset();
  mustQuery<HTMLFormElement>("#profile-form").reset();
  successState.hidden = true;
  registrationForm.hidden = false;
  stepLabel.textContent = "STEP 01 / ACCOUNT";
  title.textContent = "CREATOR REGISTRIEREN";
});

function updateProfileProgress(): void {
  const profile = buildProfileInput();
  if (!profile) return;
  const completeness = calculateProfileCompleteness(profile);
  percentLabel.textContent = `${completeness.percentage}%`;
  progressFill.style.width = `${completeness.percentage}%`;
}
