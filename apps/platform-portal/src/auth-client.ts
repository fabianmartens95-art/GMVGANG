import "./auth.css";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

async function postJson(endpoint: string, payload?: unknown): Promise<AuthActionResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: unknown } | null;
      return { ok: false, error: typeof data?.error === "string" ? data.error : "auth_unavailable" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "auth_unavailable" };
  }
}

export function requestMagicLink(email: string, next = "/"): Promise<AuthActionResult> {
  return postJson("/api/auth/sign-in", { email, next });
}

export function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  return postJson("/api/auth/sign-in", { email, password });
}

export function requestPasswordRecovery(email: string): Promise<AuthActionResult> {
  return postJson("/api/auth/password-recovery", { email });
}

export function updatePassword(password: string): Promise<AuthActionResult> {
  return postJson("/api/auth/password", { password });
}

export function signOut(): Promise<AuthActionResult> {
  return postJson("/api/auth/sign-out");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const cleaned = value.trim();
  if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.includes("\\") || cleaned.length > 512) {
    return fallback;
  }
  try {
    const parsed = new URL(cleaned, "https://gmvgang.local");
    if (parsed.origin !== "https://gmvgang.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function loginErrorCopy(error: string): string {
  if (error === "invalid_credentials") return "E-Mail-Adresse oder Passwort ist nicht korrekt.";
  if (error === "rate_limited") return "Zu viele Login-Versuche. Bitte versuche es später erneut oder nutze den Login-Link.";
  return "Der Login ist aktuell nicht verfügbar. Bitte versuche es erneut.";
}

export function renderLogin(authenticated: boolean): string {
  const params = new URLSearchParams(window.location.search);
  const next = safeNextPath(params.get("next"));
  const authError = params.get("error");

  if (authenticated) {
    return `
      <main class="auth-page">
        <section class="auth-card">
          <div class="eyebrow">ACCOUNT</div>
          <h1>Du bist eingeloggt</h1>
          <p>Deine serverseitige Session ist aktiv. Du kannst direkt zum gewünschten Portalbereich wechseln oder dein Passwort verwalten.</p>
          <div class="auth-actions">
            <a class="button" href="${escapeHtml(next)}" data-nav>Weiter zum Portal</a>
            <a class="auth-secondary-link" href="/account/password">Passwort verwalten</a>
          </div>
        </section>
      </main>`;
  }

  return `
    <main class="auth-page">
      <section class="auth-card">
        <div class="eyebrow">GMVGANG LOGIN</div>
        <h1>Einloggen</h1>
        <p>Logge dich mit E-Mail und Passwort ein. Der bisherige sichere Login-Link bleibt als Alternative bestehen.</p>
        ${authError ? '<div class="auth-error">Der Login-Link konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.</div>' : ""}
        <form id="auth-login-form" class="auth-form">
          <label>
            <span>E-Mail-Adresse</span>
            <input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="name@firma.de" />
          </label>
          <label>
            <span>Passwort</span>
            <input type="password" name="password" autocomplete="current-password" required maxlength="128" placeholder="Dein Passwort" />
          </label>
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <button type="submit" class="join-submit">Einloggen</button>
          <div class="auth-divider"><span>oder</span></div>
          <button type="button" id="auth-magic-link" class="auth-secondary-button">Sicheren Login-Link senden</button>
          <button type="button" id="auth-password-recovery" class="auth-secondary-button">Passwort vergessen</button>
          <p class="auth-help">Noch kein Passwort? Nutze den sicheren Login-Link. Bei einem vergessenen Passwort senden wir dir einen separaten Recovery-Link zum Festlegen eines neuen Passworts.</p>
          <div id="auth-login-result" class="join-result" aria-live="polite"></div>
        </form>
      </section>
    </main>`;
}

export function wireLogin(): void {
  const form = document.querySelector<HTMLFormElement>("#auth-login-form");
  const result = document.querySelector<HTMLDivElement>("#auth-login-result");
  const magicButton = document.querySelector<HTMLButtonElement>("#auth-magic-link");
  const recoveryButton = document.querySelector<HTMLButtonElement>("#auth-password-recovery");
  if (!form || !result) return;

  const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
  const passwordInput = form.querySelector<HTMLInputElement>('input[name="password"]');
  const nextInput = form.querySelector<HTMLInputElement>('input[name="next"]');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || !emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const next = safeNextPath(nextInput?.value ?? "/");
    if (submitButton) submitButton.disabled = true;
    if (magicButton) magicButton.disabled = true;
    if (recoveryButton) recoveryButton.disabled = true;
    result.textContent = "Login wird geprüft …";

    const response = await signInWithPassword(email, password);
    if (!response.ok) {
      result.textContent = loginErrorCopy(response.error);
      if (submitButton) submitButton.disabled = false;
      if (magicButton) magicButton.disabled = false;
      if (recoveryButton) recoveryButton.disabled = false;
      return;
    }

    result.innerHTML = "<strong>Login erfolgreich.</strong> Portal wird geöffnet …";
    window.location.assign(next);
  });

  magicButton?.addEventListener("click", async () => {
    if (!emailInput || !emailInput.reportValidity()) return;
    const email = emailInput.value.trim();
    const next = safeNextPath(nextInput?.value ?? "/");
    if (submitButton) submitButton.disabled = true;
    magicButton.disabled = true;
    if (recoveryButton) recoveryButton.disabled = true;
    result.textContent = "Login-Link wird gesendet …";

    const response = await requestMagicLink(email, next);
    if (!response.ok) {
      result.textContent = response.error === "rate_limited"
        ? "Zu viele Anfragen. Bitte versuche es später erneut."
        : "Der Login-Link konnte aktuell nicht gesendet werden. Bitte versuche es erneut.";
      if (submitButton) submitButton.disabled = false;
      magicButton.disabled = false;
      if (recoveryButton) recoveryButton.disabled = false;
      return;
    }

    result.innerHTML = "<strong>Login-Link gesendet.</strong> Prüfe dein E-Mail-Postfach und öffne den Link.";
    if (submitButton) submitButton.disabled = false;
    magicButton.disabled = false;
    if (recoveryButton) recoveryButton.disabled = false;
  });

  recoveryButton?.addEventListener("click", async () => {
    if (!emailInput || !emailInput.reportValidity()) return;
    const email = emailInput.value.trim();
    if (submitButton) submitButton.disabled = true;
    if (magicButton) magicButton.disabled = true;
    recoveryButton.disabled = true;
    result.textContent = "Recovery-Link wird angefordert …";

    const response = await requestPasswordRecovery(email);
    if (!response.ok) {
      result.textContent = response.error === "rate_limited"
        ? "Zu viele Anfragen. Bitte versuche es später erneut."
        : "Der Recovery-Link konnte aktuell nicht angefordert werden. Bitte versuche es erneut.";
      if (submitButton) submitButton.disabled = false;
      if (magicButton) magicButton.disabled = false;
      recoveryButton.disabled = false;
      return;
    }

    result.innerHTML = "<strong>Wenn ein Account zu dieser E-Mail existiert, wurde ein Recovery-Link gesendet.</strong> Öffne ihn, um ein neues Passwort festzulegen.";
    if (submitButton) submitButton.disabled = false;
    if (magicButton) magicButton.disabled = false;
    recoveryButton.disabled = false;
  });
}

export function renderPasswordSettings(authenticated: boolean): string {
  const params = new URLSearchParams(window.location.search);
  const next = safeNextPath(params.get("next"));
  const recovery = params.get("recovery") === "1";

  if (!authenticated) {
    return `
      <main class="auth-page">
        <section class="auth-card">
          <div class="eyebrow">ACCOUNT SECURITY</div>
          <h1>${recovery ? "Passwort-Recovery" : "Passwort"}</h1>
          <p>${recovery ? "Der Recovery-Link ist nicht mehr gültig oder deine Sitzung fehlt. Fordere am Login einen neuen Recovery-Link an." : "Zum Festlegen oder Ändern deines Passworts musst du eingeloggt sein."}</p>
          <a class="button" href="/login" data-nav>Zum Login</a>
        </section>
      </main>`;
  }

  return `
    <main class="auth-page">
      <section class="auth-card">
        <div class="eyebrow">ACCOUNT SECURITY</div>
        <h1>${recovery ? "Neues Passwort festlegen" : "Passwort"}</h1>
        <p>${recovery ? "Dein Recovery-Link wurde bestätigt. Lege jetzt ein neues Passwort für deinen GMVGANG-Account fest." : "Lege ein Passwort für deinen bestehenden GMVGANG-Account fest oder ersetze dein aktuelles Passwort."}</p>
        <form id="auth-password-form" class="auth-form">
          <label>
            <span>Neues Passwort</span>
            <input type="password" name="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="Mindestens 8 Zeichen" />
          </label>
          <label>
            <span>Passwort bestätigen</span>
            <input type="password" name="password_confirm" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="Passwort wiederholen" />
          </label>
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <button type="submit" class="join-submit">Passwort speichern</button>
          <div id="auth-password-result" class="join-result" aria-live="polite"></div>
        </form>
      </section>
    </main>`;
}

export function wirePasswordSettings(): void {
  const form = document.querySelector<HTMLFormElement>("#auth-password-form");
  const result = document.querySelector<HTMLDivElement>("#auth-password-result");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("password_confirm") ?? "");
    const next = safeNextPath(String(data.get("next") ?? "/"));
    if (password !== confirmation) {
      result.textContent = "Die Passwörter stimmen nicht überein.";
      return;
    }

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    result.textContent = "Passwort wird gespeichert …";

    const response = await updatePassword(password);
    if (!response.ok) {
      result.textContent = response.error === "weak_password"
        ? "Das Passwort erfüllt die Anforderungen nicht. Verwende mindestens 8 Zeichen."
        : response.error === "authentication_required"
          ? "Deine Sitzung ist nicht mehr gültig. Melde dich erneut an."
          : "Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.";
      if (button) button.disabled = false;
      return;
    }

    result.innerHTML = `<strong>Passwort gespeichert.</strong> Du kannst dich ab jetzt mit E-Mail und Passwort einloggen. <a href="${escapeHtml(next)}">Weiter zum Portal</a>`;
    form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => { input.value = ""; });
    if (button) button.disabled = false;
  });
}
