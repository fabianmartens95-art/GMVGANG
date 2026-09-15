import "./styles.css";

import { canAccessArea, defaultAreaForSession, PORTAL_ROUTES, resolvePortalRoute, type PortalArea } from "./routing.js";
import { EnvironmentSessionAdapter, type PortalSession } from "./session.js";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("APP_ROOT_NOT_FOUND");

const sessionPort = new EnvironmentSessionAdapter();
let session: PortalSession = { status: "anonymous", roles: [] };

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
    description: "Shop-Verbindungen, Kampagnen, Creator-Shortlists, Freigaben und Economics ohne interne Company-OS-Strukturen.",
    modules: ["TikTok Shop Connections", "Campaigns", "Creator Shortlists", "Approvals", "Economics & Guardrails", "Reporting"],
  },
  team: {
    eyebrow: "Internal Operations",
    title: "Team Workspace",
    description: "Rollenbasierte Arbeitsbereiche für Founder, Creator Manager, Brand Manager und Closer.",
    modules: ["Creator Operations", "Brand Operations", "Campaign Control", "Approval Center", "Risk & Stale Alerts", "Activity Trail"],
  },
};

function statusPill(label: string, tone: "ready" | "next" | "locked" = "ready"): string {
  return `<span class="status status--${tone}">${label}</span>`;
}

function navigation(): string {
  const defaultArea = defaultAreaForSession(session);
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
          const active = resolvePortalRoute(window.location.pathname).area === route.area;
          return `<a href="${route.path}" data-nav class="nav__link${active ? " is-active" : ""}${accessible ? "" : " is-locked"}" aria-disabled="${accessible ? "false" : "true"}">${route.label}</a>`;
        }).join("")}
      </nav>
      <div class="session-chip">
        <span class="session-dot ${session.status === "authenticated" ? "is-authenticated" : ""}"></span>
        ${session.status === "authenticated" ? session.roles.join(", ") : `Auth ausstehend · Default ${defaultArea}`}
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
            ${statusPill("App Shell · in build", "next")}
            ${statusPill("Auth/Persistence Adapter · next", "locked")}
          </div>
        </div>
        <aside class="architecture-card">
          <div class="architecture-card__label">CURRENT ARCHITECTURE</div>
          <div class="stack-item"><strong>Creator Portal</strong><span>Profile · Referrals · Matches</span></div>
          <div class="connector"></div>
          <div class="stack-item stack-item--core"><strong>GMVGANG Core</strong><span>RBAC · Matching · Campaigns · Economics</span></div>
          <div class="connector"></div>
          <div class="stack-item"><strong>Brand + Team</strong><span>Shops · Approvals · Operations</span></div>
        </aside>
      </section>

      <section class="portal-grid" aria-label="Portal Bereiche">
        ${portalEntry("creator", "CREATOR", "Offene Registrierung, Creator-Profil, Referral Hub und später TikTok-Shop-Connect.")}
        ${portalEntry("brand", "BRAND", "Brand Accounts, TikTok-Shop-Seller-Connect, Campaigns, Shortlists und Reports.")}
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

function protectedView(area: Exclude<PortalArea, "public">): string {
  const copy = areaCopy[area];
  if (!canAccessArea(session, area)) {
    return `
      <main class="locked-view">
        <div class="locked-view__box">
          ${statusPill("PROTECTED AREA", "locked")}
          <div class="lock-icon">↗</div>
          <h1>${copy.title}</h1>
          <p>Dieser Bereich ist rollenbasiert geschützt. Der produktive Auth-/Persistence-Adapter wird als nächste technische Schicht angeschlossen; bis dahin bleibt Production fail-closed.</p>
          <a href="/" data-nav class="button">Zur Platform Übersicht</a>
        </div>
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
        <span>UI access is derived from the shared Platform Foundation roles. Production remains anonymous until a real authentication adapter is configured.</span>
      </section>
    </main>`;
}

function wireNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = new URL(link.href);
      window.history.pushState({}, "", url.pathname);
      void render();
    });
  });
}

async function render(): Promise<void> {
  session = await sessionPort.getSession();
  const route = resolvePortalRoute(window.location.pathname);
  const body = route.area === "public" ? publicView() : protectedView(route.area);
  app.innerHTML = `${navigation()}${body}<footer><span>GMVGANG PLATFORM</span><span>Notion remains operational SSOT · Platform code on GitHub</span></footer>`;
  wireNavigation();
}

window.addEventListener("popstate", () => void render());
void render();
