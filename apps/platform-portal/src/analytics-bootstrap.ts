type PortalAnalyticsEventName =
  | "portal.page_view"
  | "portal.navigation"
  | "portal.sign_out_clicked"
  | "creator.registration.submitted"
  | "creator.profile.submitted"
  | "creator.qualification.submitted";

type AnalyticsState = "unknown" | "authenticated" | "anonymous";

const endpoint = "/api/analytics/events";
const clientSessionId = crypto.randomUUID();
let analyticsState: AnalyticsState = "unknown";
let lastPagePath = "";

function currentPath(): string {
  return window.location.pathname || "/";
}

function sameOriginPath(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

async function sendEvent(
  eventName: PortalAnalyticsEventName,
  properties: Record<string, string> = {},
): Promise<void> {
  if (analyticsState === "anonymous") return;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        path: currentPath(),
        clientSessionId,
        properties,
      }),
    });

    if (response.status === 401) {
      analyticsState = "anonymous";
      return;
    }
    if (response.ok) analyticsState = "authenticated";
  } catch {
    // Analytics must never block or change the portal journey.
  }
}

function trackPageView(): void {
  const path = currentPath();
  if (path === lastPagePath) return;
  lastPagePath = path;
  void sendEvent("portal.page_view");
}

const originalPushState = window.history.pushState;
window.history.pushState = function pushState(data: unknown, unused: string, url?: string | URL | null): void {
  originalPushState.call(window.history, data, unused, url);
  queueMicrotask(trackPageView);
};

const originalReplaceState = window.history.replaceState;
window.history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null): void {
  originalReplaceState.call(window.history, data, unused, url);
  queueMicrotask(trackPageView);
};

window.addEventListener("popstate", () => queueMicrotask(trackPageView));

document.addEventListener("click", (event) => {
  const element = event.target instanceof Element ? event.target : null;
  if (!element) return;

  const signOut = element.closest<HTMLButtonElement>("#sign-out");
  if (signOut) {
    void sendEvent("portal.sign_out_clicked");
    return;
  }

  const link = element.closest<HTMLAnchorElement>("a[data-nav]");
  if (!link) return;
  const targetPath = sameOriginPath(link.href);
  if (!targetPath) return;
  void sendEvent("portal.navigation", { targetPath });
}, true);

document.addEventListener("submit", (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;

  const eventName: PortalAnalyticsEventName | undefined = {
    "creator-registration-form": "creator.registration.submitted",
    "creator-profile-form": "creator.profile.submitted",
    "creator-qualification-form": "creator.qualification.submitted",
  }[form.id] as PortalAnalyticsEventName | undefined;

  if (eventName) void sendEvent(eventName);
}, true);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => queueMicrotask(trackPageView), { once: true });
} else {
  queueMicrotask(trackPageView);
}
