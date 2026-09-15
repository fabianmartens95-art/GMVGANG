import {
  normalizeReferralCode,
  validateCreatorRegistration,
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
            <p class="step">STEP 01 / ACCOUNT</p>
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
          <button class="primary-button" type="submit">PROFIL STARTEN <span aria-hidden="true">→</span></button>
          <p class="privacy-note">Diese Preview sendet noch keine personenbezogenen Daten. Der sichere Server-Adapter wird vor Public Launch aktiviert.</p>
        </form>

        <div id="success-state" class="success-state" hidden>
          <p class="step">REGISTRATION GATE GREEN</p>
          <h2>PROFIL KANN ANGELEGT WERDEN.</h2>
          <p>Die Eingaben erfüllen das Creator-Registration-Gate. Als Nächstes wird der serverseitige Auth- und Company-OS-Adapter angeschlossen.</p>
          <button id="reset-form" class="secondary-button" type="button">ZURÜCK</button>
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

function buildInput(): CreatorRegistrationInput {
  return {
    displayName: mustQuery<HTMLInputElement>("#display-name").value,
    tiktokHandle: mustQuery<HTMLInputElement>("#tiktok-handle").value,
    email: mustQuery<HTMLInputElement>("#email").value,
    ageConfirmed: mustQuery<HTMLInputElement>("#age-confirmed").checked,
    privacyAccepted: mustQuery<HTMLInputElement>("#privacy-accepted").checked,
    referralCode: mustQuery<HTMLInputElement>("#referral-code").value || undefined
  };
}

const errorLabels: Record<string, string> = {
  display_name_required: "Bitte gib deinen Namen an.",
  invalid_tiktok_handle: "Bitte prüfe deinen TikTok Username.",
  invalid_email: "Bitte gib eine gültige E-Mail-Adresse an.",
  age_confirmation_required: "Die Registrierung ist nur ab 18 möglich.",
  privacy_acceptance_required: "Bitte akzeptiere die Datenschutzbedingungen.",
  invalid_referral_code: "Der Referral-Code ist ungültig."
};

const form = mustQuery<HTMLFormElement>("#registration-form");
const successState = mustQuery<HTMLElement>("#success-state");
const errorBox = mustQuery<HTMLElement>("#form-errors");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validateCreatorRegistration(buildInput());

  if (!result.ok) {
    errorBox.hidden = false;
    errorBox.innerHTML = result.errors.map((error) => `<p>${errorLabels[error] ?? error}</p>`).join("");
    return;
  }

  errorBox.hidden = true;
  errorBox.textContent = "";
  form.hidden = true;
  successState.hidden = false;
});

mustQuery<HTMLButtonElement>("#reset-form").addEventListener("click", () => {
  form.hidden = false;
  successState.hidden = true;
});
