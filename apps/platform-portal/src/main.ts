import "./styles.css";

import type { PlatformWorkspaceAccess } from "@gmvgang/platform-foundation";
import { createBrandOverviewPort, loadBrandOverview, renderBrandOverview } from "./brand-workspace.js";
import { HttpCreatorRegistrationAdapter, renderCreatorJoin, wireCreatorJoin } from "./creator-join.js";
import { canAccessArea, defaultAreaForSession, PORTAL_ROUTES, resolvePortalRoute, type PortalArea } from "./routing.js";
import { createSessionPort, type PortalSession } from "./session.js";
import { createWorkspacePort } from "./workspaces.js";

const app = document.querySelector<HTMLDivElement>("#app") ?? (() => { throw new Error("APP_ROOT_NOT_FOUND"); })();

let session: PortalSession = { status: "anonymous", roles: [] };
let workspaces: readonly PlatformWorkspaceAccess[] = [];

const areaCopy: Record<Exclude<PortalArea, "public">, { eyebrow: string; title: string; description: string; modules: string[] }> = {
  creator: {
    eyebrow: "Creator Network",
    title: "Creator Portal",
    description: "Profil, Netzwerkstatus, Referral-Wachstum und spätere Campaign-Aktivierung in einer Oberfläche.",
    modules: ["Profil & Completion", "Network Status", "Referral Hub", "Matches", "Samples & Briefings", "Performance"],
  },
  brand: {
    eyebrow: "Brand Growth",
    title: "Brand Portal",
    description: "Profitability, priorisierte Maßnahmen, Campaigns, Creator Intelligence und Freigaben ohne interne Company-OS-Strukturen.",
    modules: ["TikTok Shop Connections", "Campaigns", "Creator Shortlists", "Approvals", "Economics & Guardrails", "Reporting"],
  },
  team: {
    eyebrow: "Internal Operations",
    title: "Team Workspace",
    description: "Rollenbasierte Arbeitsbereiche für Founder, Creator Manager, Brand Manager und Closer.",
    modules: ["Creator Operations", "Brand Operations", "Campaign Control", "Approval Center", "Risk & Stale Alerts", "Activity Trail"],
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedWorkspaceId(): string | undefined {
  const selected = new URLSearchParams(window.location.search).get("workspace")?.trim();
  return selected || undefined;
}

function statusPill(label: string, tone: "ready" | "next" | "locked" = "ready"): string {
  return `<span class="status status--${tone}">${label}</span>`;
}

function workspaceSelector(): string {
  if (session.status !== "authenticated" || workspaces.length <= 1) return "";

  return `
    <label class="workspace-switcher">
      <span>Workspace</span>
      <select id="workspace-selector" aria-label="Workspace auswählen">
        ${session.organizationId ? "" : '<option value="" selected disabled>Workspace wählen</option>'}
        ${workspaces.map((workspace) => `
          <option value="${escapeHtml(workspace.organizationId)}"${workspace.organizationId === session.organizationId ? " selected" : ""}>
            ${escapeHtml(workspace.name)}
          </option>`).join("")}
      </select>
    </label>`;
}

function navigation(): string {
  const defaultArea = defaultAreaForSession(session);
  const currentRoute = resolvePortalRoute(window.location.pathname);
  const currentWorkspace = session.status === "authenticated"
    ? workspaces.find((workspace) => workspace.organizationId === session.organizationId)
    : undefined;

  return `
    <header class="topbar">
      <a class="brand" href="/" data-nav>
        <span class="brand__mark">G</span>
        <span>GMVGANG</span>
        <small>PLATFORM</small>
      </a>
      <nav class="nav" aria-label="Portal Navigation">
        ${PORTAL_ROUTES.map((route) => {
          const accessible = canAccessArea(session, route.area);
          const active = currentRoute.path === route.path;
          return `<a href="${route.path}" data-nav class="nav__link${active ? " is-active" : ""}${accessible ? "" : " is-locked"}" aria-disabled="${accessible ? "false" : "true"}">${route.label}</a>`;
        }).join("")}
      </nav>
      <div class="session-controls">
        ${workspaceSelector()}
        <div class="session-chip">
          <span class="session-dot ${session.status === "authenticated" ? "is-authenticated" : ""}"></span>
          ${session.status === "authenticated"
            ? `${currentWorkspace ? escapeHtml(currentWorkspace.name) : "authenticated"} · ${session.roles.join(", ") || "workspace required"}`
            : `Auth ausstehend · Default ${defaultArea}`}
        </div>
      </div>
    </header>`;
}

function publicView(): string {
  return `
    <main>
      <section class="hero">
        <div class="hero__copy">
          <div class="eyebrow">GMVGANG PLATFORM FOUNDATION</div>
          <h1>Ein System.<br><span>Getrennte Zugänge.</span></h1>
          <p>Die gemeinsame Portal-Schicht für Creator, Brands und das interne GMVGANG-Team. Business-Logik bleibt zentral, Rollen und Tenant-Grenzen sind explizit.</p>
          <div class="hero__badges">
            ${statusPill("Domain Foundation · live on main")}
            ${statusPill("Server Session Boundary · ready")}
            ${statusPill("Creator Registration Core · ready")}
            ${statusPill("Provider + Persistence · next", "next")}
          </div>
        </div>
        <aside class="architecture-card">
          <div class="architecture-card__label">CURRENT ARCHITECTURE</div>
          <div class="stack-item"><strong>Creator Portal</strong><span>Registration · Profile · Referrals · Matches</span></div>
          <div class="connector"></div>
          <div class="stack-item stack-item--core"><strong>GMVGANG Core</strong><span>RBAC · Matching · Campaigns · Economics</span></div>
          <div class="connector"></div>
          <div class="stack-item"><strong>Brand + Team</strong><span>Profitability · Actions · Operations</span></div>
        </aside>
      </section>

      <section class="portal-grid" aria-label="Portal Bereiche">
        ${portalEntry("creator", "CREATOR", "Offene Registrierung, Creator-Profil, Referral Hub und später TikTok-Shop-Connect.")}
        ${portalEntry("brand", "BRAND", "Profitability Center, Next Best Actions, Campaigns, Creator Intelligence und Reports.")}
        ${portalEntry("team", "TEAM", "Founder, Admin, Creator Manager, Brand Manager und Closer mit getrennten Rechten.")}
      </section>

      <section class="foundation-strip">
        <div><span>01</span><strong>Identity</strong><small>User · Organization · Membership</small></div>
        <div><span>02</span><strong>RBAC</strong><small>Deny by default · scoped access</small></div>
        <div><span>03</span><strong>Growth</strong><small>Immutable Referral Attribution</small></div>
        <div><span>04</span><strong>Connections</strong><small>Seller / Creator API boundaries</small></div>
      </section>
    </main>`;
}

function portalEntry(area: Exclude<PortalArea, "public">, label: string, text: string): string {
  const accessible = canAccessArea(session, area);
  return `
    <article class="portal-card">
      <div class="portal-card__top"><span>${label}</span>${statusPill(accessible ? "ACCESS" : "LOCKED", accessible ? "ready" : "locked")}</div>
      <h2>${areaCopy[area].title}</h2>
      <p>${text}</p>
      <a href="/${area}" data-nav class="portal-card__link">Bereich öffnen <span>→</span></a>
    </article>`;
}

async function protectedView(area: Exclude<PortalArea, "public">): Promise<string> {
  const copy = areaCopy[area];
  if (!canAccessArea(session, area)) {
    return `
      <main class="locked-view">
        <div class="locked-view__box">
          ${statusPill("PROTECTED AREA", "locked")}
          <div class="lock-icon">↗</div>
          <h1>${copy.title}</h1>
          <p>Dieser Bereich ist rollenbasiert geschützt. Production akzeptiert nur serverseitig aufgelöste Sessions; ohne gültigen Provider-/Persistence-Adapter bleibt der Zugriff fail-closed.</p>
          <a href="/" data-nav class="button">Zur Platform Übersicht</a>
        </div>
      </main>`;
  }

  if (area === "brand" && session.status === "authenticated" && session.organizationId) {
    const overview = await loadBrandOverview(session.organizationId, createBrandOverviewPort(session.organizationId));
    return `
      <main class="workspace">
        <section class="workspace__intro">
          <div>
            <div class="eyebrow">${copy.eyebrow}</div>
            <h1>${copy.title}</h1>
            <p>${copy.description}</p>
          </div>
          ${statusPill("TENANT BOUND")}
        </section>
        ${renderBrandOverview(overview)}
        <section class="boundary-note">
          <strong>Tenant boundary</strong>
          <span>Brand-Daten werden nur akzeptiert, wenn die serverseitige Overview dieselbe Organization-ID wie die verifizierte Portal-Session trägt.</span>
        </section>
      </main>`;
  }

  return `
    <main class="workspace">
      <section class="workspace__intro">
        <div>
          <div class="eyebrow">${copy.eyebrow}</div>
          <h1>${copy.title}</h1>
          <p>${copy.description}</p>
        </div>
        ${statusPill("ROLE BOUNDARY ACTIVE")}
      </section>
      <section class="module-grid">
        ${copy.modules.map((module, index) => `
          <article class="module-card">
            <span class="module-card__number">0${index + 1}</span>
            <h2>${module}</h2>
            <p>${index < 3 ? "Foundation contract ready." : "Scheduled for portal MVP."}</p>
            ${statusPill(index < 3 ? "FOUNDATION" : "NEXT", index < 3 ? "ready" : "next")}
          </article>`).join("")}
      </section>
      <section class="boundary-note">
        <strong>Security boundary</strong>
        <span>UI access is derived from the shared Platform Foundation roles. Production sessions come from the same-origin server boundary.</span>
      </section>
    </main>`;
}

function wireNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = new URL(link.href);
      const workspaceId = selectedWorkspaceId();
      if (workspaceId) url.searchParams.set("workspace", workspaceId);
      window.history.pushState({}, "", `${url.pathname}${url.search}`);
      void render();
    });
  });
}

function wireWorkspaceSelector(): void {
  const selector = document.querySelector<HTMLSelectElement>("#workspace-selector");
  selector?.addEventListener("change", () => {
    const organizationId = selector.value.trim();
    if (!organizationId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", organizationId);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    void render();
  });
}

async function render(): Promise<void> {
  const requestedWorkspaceId = selectedWorkspaceId();
  session = await createSessionPort(requestedWorkspaceId).getSession();
  workspaces = session.status === "authenticated" ? await createWorkspacePort().getWorkspaces() : [];

  const route = resolvePortalRoute(window.location.pathname);
  const referralCode = new URLSearchParams(window.location.search).get("ref") ?? undefined;
  const privacyNoticeVersion = String(import.meta.env.VITE_CREATOR_PRIVACY_NOTICE_VERSION ?? "").trim();
  const body = route.path === "/join"
    ? renderCreatorJoin(session, { privacyNoticeVersion, ...(referralCode ? { referralCode } : {}) })
    : route.area === "public"
      ? publicView()
      : await protectedView(route.area);

  app.innerHTML = `${navigation()}${body}<footer><span>GMVGANG PLATFORM</span><span>Notion remains operational SSOT · Platform code on GitHub</span></footer>`;
  wireNavigation();
  wireWorkspaceSelector();
  if (route.path === "/join") wireCreatorJoin(new HttpCreatorRegistrationAdapter());
}

window.addEventListener("popstate", () => void render());
void render();
