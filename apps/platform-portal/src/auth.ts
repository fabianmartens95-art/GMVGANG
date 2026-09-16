import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrowserAuthConfig = {
  url: string;
  publishableKey: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeNextPath(value: string | null | undefined, fallback = "/join"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) return fallback;
  try {
    const parsed = new URL(trimmed, "https://gmvgang.local");
    if (parsed.origin !== "https://gmvgang.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function browserAuthConfigFromEnv(): BrowserAuthConfig | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function createBrowserAuthClient(config: BrowserAuthConfig): SupabaseClient {
  return createBrowserClient(config.url, config.publishableKey);
}

export function renderLogin(configured: boolean, nextPath: string): string {
  if (!configured) {
    return `
      <main class="auth-page">
        <section class="auth-shell">
          <div class="eyebrow">GMVGANG ACCOUNT</div>
          <h1>Login noch nicht aktiviert</h1>
          <p>Die Auth-Oberfläche ist vorbereitet, aber die öffentliche Supabase-Konfiguration ist in dieser Umgebung noch nicht gesetzt.</p>
        </section>
      </main>`;
  }

  return `
    <main class="auth-page">
      <section class="auth-shell">
        <div class="eyebrow">GMVGANG ACCOUNT</div>
        <h1>Einloggen oder Account erstellen</h1>
        <p>Du erhältst einen sicheren Login-Link per E-Mail. Für Creator kann dabei beim ersten Login automatisch ein Account angelegt werden; die Aufnahme ins vertragliche GMVGANG Creator Network erfolgt separat.</p>
        <form id="magic-link-form" class="auth-form" novalidate>
          <label>
            <span>E-Mail-Adresse</span>
            <input type="email" name="email" autocomplete="email" placeholder="name@beispiel.de" required />
          </label>
          <input type="hidden" name="next" value="${escapeHtml(nextPath)}" />
          <button type="submit">Login-Link senden</button>
          <div id="auth-result" class="auth-result" aria-live="polite"></div>
        </form>
      </section>
    </main>`;
}

export function wireMagicLinkLogin(client: SupabaseClient): void {
  const form = document.querySelector<HTMLFormElement>("#magic-link-form");
  const result = document.querySelector<HTMLDivElement>("#auth-result");
  if (!form || !result) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const next = safeNextPath(String(data.get("next") ?? "/join"));
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);

    const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (button) button.disabled = true;
    result.textContent = "Login-Link wird gesendet …";

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      result.textContent = "Der Login-Link konnte nicht gesendet werden. Bitte versuche es erneut.";
      if (button) button.disabled = false;
      return;
    }

    result.innerHTML = "<strong>E-Mail gesendet.</strong> Öffne den Login-Link auf diesem Gerät, um fortzufahren.";
  });
}

export type AuthCallbackResult =
  | { ok: true; nextPath: string }
  | { ok: false; reason: "missing_credentials" | "exchange_failed" };

export async function completeAuthCallback(
  client: SupabaseClient,
  url: URL,
): Promise<AuthCallbackResult> {
  const nextPath = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    return error ? { ok: false, reason: "exchange_failed" } : { ok: true, nextPath };
  }

  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    return error ? { ok: false, reason: "exchange_failed" } : { ok: true, nextPath };
  }

  return { ok: false, reason: "missing_credentials" };
}

export function renderAuthCallback(): string {
  return `
    <main class="auth-page">
      <section class="auth-shell">
        <div class="eyebrow">GMVGANG ACCOUNT</div>
        <h1>Login wird bestätigt …</h1>
        <p id="auth-callback-result">Die sichere Session wird aufgebaut.</p>
      </section>
    </main>`;
}
