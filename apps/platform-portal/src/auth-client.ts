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

export function renderLogin(authenticated: boolean): string {
  const params = new URLSearchParams(window.location.search);
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const authError = params.get("error");

  if (authenticated) {
    return `
      <main class="auth-page">
        <section class="auth-card">
          <div class="eyebrow">ACCOUNT</div>
          <h1>Du bist eingeloggt</h1>
          <p>Deine serverseitige Session ist aktiv. Du kannst direkt zum gewünschten Portalbereich wechseln.</p>
          <a class="button" href="${escapeHtml(next)}" data-nav>Weiter zum Portal</a>
        </section>
      </main>`;
  }

  return `
    <main class="auth-page">
      <section class="auth-card">
        <div class="eyebrow">GMVGANG LOGIN</div>
        <h1>Einloggen</h1>
        <p>Du erhältst einen sicheren Login-Link per E-Mail. Creator, Brands und Team nutzen dieselbe zentrale Account-Schicht; Rechte werden danach serverseitig aufgelöst.</p>
        ${authError ? '<div class="auth-error">Der Login-Link konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.</div>' : ""}
        <form id="auth-login-form" class="auth-form">
          <label>
            <span>E-Mail-Adresse</span>
            <input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="name@firma.de" />
          </label>
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <button type="submit" class="join-submit">Login-Link senden</button>
          <div id="auth-login-result" class="join-result" aria-live="polite"></div>
        </form>
      </section>
    </main>`;
}

export function wireLogin(): void {
  const form = document.querySelector<HTMLFormElement>("#auth-login-form");
  const result = document.querySelector<HTMLDivElement>("#auth-login-result");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const next = String(data.get("next") ?? "/");
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (button) button.disabled = true;
    result.textContent = "Login-Link wird gesendet …";

    const response = await requestMagicLink(email, next);
    if (!response.ok) {
      result.textContent = "Der Login-Link konnte aktuell nicht gesendet werden. Bitte versuche es erneut.";
      if (button) button.disabled = false;
      return;
    }

    result.innerHTML = "<strong>Login-Link gesendet.</strong> Prüfe dein E-Mail-Postfach und öffne den Link auf diesem Gerät.";
  });
}
