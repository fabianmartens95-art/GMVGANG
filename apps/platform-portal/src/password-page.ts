import { renderPasswordSettings, wirePasswordSettings } from "./auth-client.js";
import { createSessionPort } from "./session.js";

const app = document.querySelector<HTMLDivElement>("#app");
let rendering = false;

async function enhancePasswordRoute(): Promise<void> {
  if (!app || window.location.pathname.replace(/\/+$/, "") !== "/account/password" || rendering) return;

  rendering = true;
  try {
    const session = await createSessionPort().getSession();
    const currentMain = app.querySelector<HTMLElement>("main");
    if (!currentMain) return;

    const marker = `${session.status}:${window.location.search}`;
    if (currentMain.dataset.passwordPageState === marker) return;

    const holder = document.createElement("div");
    holder.innerHTML = renderPasswordSettings(session.status === "authenticated").trim();
    const replacement = holder.firstElementChild;
    if (!(replacement instanceof HTMLElement)) return;

    replacement.dataset.passwordPageState = marker;
    currentMain.replaceWith(replacement);
    if (session.status === "authenticated") wirePasswordSettings();
  } finally {
    rendering = false;
  }
}

void enhancePasswordRoute();

const observer = new MutationObserver(() => {
  void enhancePasswordRoute();
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("popstate", () => {
  void enhancePasswordRoute();
});
