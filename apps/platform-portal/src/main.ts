import "./styles.css";
import "./session-controls.css";
import "./module-navigation.css";
import "./creator-profile.css";
import "./creator-qualification.css";
import "./creator-referrals.css";
import "./creator-workspace.css";
import "./team-creator-funnel.css";
import "./team-admin.css";

import type { PlatformWorkspaceAccess } from "@gmvgang/platform-foundation";
import { renderLogin, signOut, wireLogin } from "./auth-client.js";
import { createBrandOverviewPort, loadBrandOverview, renderBrandOverview } from "./brand-workspace.js";
import { HttpCreatorRegistrationAdapter, renderCreatorJoin, wireCreatorJoin } from "./creator-join.js";
import {
  HttpCreatorQualificationAdapter,
  renderCreatorQualification,
  wireCreatorQualification,
} from "./creator-qualification.js";
import { HttpCreatorProfileAdapter, renderCreatorProfile, wireCreatorProfile } from "./creator-profile.js";
import { HttpCreatorReferralHubAdapter, renderCreatorReferralHub, wireCreatorReferralHub } from "./creator-referrals.js";
import {
  HttpCreatorWorkspaceAdapter,
  renderCreatorCampaigns,
  renderCreatorMatches,
  renderCreatorPerformance,
} from "./creator-workspace.js";
import {
  canAccessArea,
  canAccessRoute,
  moduleRoutesForArea,
  PRIMARY_PORTAL_ROUTES,
  resolvePortalRoute,
  type PortalArea,
  type PortalRoute,
} from "./routing.js";
import { createSessionPort, type PortalSession } from "./session.js";
import {
  HttpTeamCreatorFunnelAdapter,
  renderTeamActivityTrail,
  renderTeamCreatorOperations,
} from "./team-creator-funnel.js";
import { HttpTeamAdminAdapter, renderTeamAdmin, wireTeamAdmin } from "./team-admin.js";
import { createWorkspacePort } from "./workspaces.js";

const app = document.querySelector<HTMLDivElement>("#app") ?? (() => { throw new Error("APP_ROOT_NOT_FOUND"); })();

let session: PortalSession = { status: "anonymous", roles: [] };
let workspaces: readonly PlatformWorkspaceAccess[] = [];

const areaCopy: Record<Exclude<PortalArea, "public">, { eyebrow: string; title: string; description: string }> = {
  creator: {
    eyebrow: "Creator Network",
    title: "Creator Portal",
    description: "Profil, Qualifizierung, Referral-Wachstum, Matches und Campaign-Fortschritt in einer Oberfläche.",
  },
  brand: {
    eyebrow: "Brand Growth",
    title: "Brand Portal",
    description: "Profitability, priorisierte Maßnahmen, Campaigns, Creator Intelligence und Freigaben ohne interne Company-OS-Strukturen.",
  },
  team: {
    eyebrow: "Internal Operations",
    title: "Team Workspace",
    description: "Rollenbasierte Arbeitsbereiche für Founder, Creator Manager, Brand Manager und Closer.",
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
  const currentOrganizationId = session.organizationId;

  return `
    <label class="workspace-switcher">
      <span>Workspace</span>
      <select id="workspace-selector" aria-label="Workspace auswählen">
        ${currentOrganizationId ? "" : '<option value="" selected disabled>Workspace wählen</option>'}
        ${workspaces.map((workspace) => `
          <option value="${escapeHtml(workspace.organizationId)}"${workspace.organizationId === currentOrganizationId ? " selected" : ""}>
            ${escapeHtml(workspace.name)}
          </option>`).join("")}
      </select>
    </label>`;
}

function navigation(): string {
  const currentRoute = resolvePortalRoute(window.location.pathname);
  const currentOrganizationId = session.status === "authenticated" ? session.organizationId : undefined;
  const currentWorkspace = currentOrganizationId
    ? workspaces.find((workspace) => workspace.organizationId === currentOrganizationId)
    : undefined;
  const primaryRoutes = PRIMARY_PORTAL_ROUTES.filter(
    (route) =>
      (route.area === "public" || canAccessArea(session, route.area)) &&
      (route.path !== "/login" || session.status !== "authenticated") &&
      (route.path !== "/join" || !canAccessArea(session, "creator")),
  );
  const accountLabel = session.status === "authenticated"
    ? escapeHtml(session.email ?? "GMVGANG Account")
    : "Nicht eingeloggt";
  const accountContext = session.status === "authenticated"
    ? `${currentWorkspace ? escapeHtml(currentWorkspace.name) : "Kein Workspace"} · ${session.roles.join(", ") || "Keine Rolle"}`
    : "Portal";

  return `
    <header class="topbar">
      <a class="brand" href="/" data-nav>
        <span class="brand__mark">G</span>
        <span>GMVGANG</span>
        <small>PLATFORM</small>
      </a>
      <nav class="nav" aria-label="Portal Navigation">
        ${primaryRoutes.map((route) => {
          const accessible = canAccessArea(session, route.area);
          const active = route.area === "public"
            ? currentRoute.path === route.path
            : currentRoute.area === route.area;
          return `<a href="${route.path}" data-nav class="nav__link${active ? " is-active" : ""}${accessible ? "" : " is-locked"}" aria-disabled="${accessible ? "false" : "true"}">${route.label}</a>`;
        }).join("")}
      </nav>
      <div class="session-controls">
        ${workspaceSelector()}
        <div class="session-chip">
          <span class="session-dot ${session.status === "authenticated" ? "is-authenticated" : ""}"></span>
          <span class="session-chip__copy">
            <strong>${accountLabel}</strong>
            <small>${accountContext}</small>
          </span>
        </div>
        ${session.status === "authenticated" ? '<button id="sign-out" class="session-action" type="button">Abmelden</button>' : ""}
      </div>
    </header>`;
}

function publicView(): string {
  return `
    <main>
      <section class="hero">
        <div class="hero__copy">
          <div class="eyebrow">GMVGANG PORTAL</div>
          <h1>Willkommen bei<br><span>GMVGANG.</span></h1>
          <p>Creator können direkt starten. Bestehende Creator-, Brand- und Team-Accounts melden sich über ihren GMVGANG-Zugang an.</p>
          <div class="hero__badges">
            <a href="/join" data-nav class="button">Als Creator starten</a>
            <a href="/login" data-nav class="button">Einloggen</a>
          </div>
        </div>
        <aside class="architecture-card">
          <div class="architecture-card__label">DEIN ZUGANG</div>
          <div class="stack-item">
            <strong>Creator</strong>
            <span>Profil anlegen, Qualifizierung abschließen und verfügbare Matches und Campaigns verwalten.</span>
          </div>
          <div class="connector"></div>
          <div class="stack-item stack-item--core">
            <strong>Bestehender Account</strong>
            <span>Einloggen und direkt in den für deinen Account freigeschalteten Bereich wechseln.</span>
          </div>
        </aside>
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

function moduleNavigation(area: Exclude<PortalArea, "public">, currentRoute: PortalRoute): string {
  const copy = areaCopy[area];
  const routes = moduleRoutesForArea(area).filter((route) => canAccessRoute(session, route));
  return `
    <nav class="module-nav" aria-label="${escapeHtml(copy.title)} Module">
      <a href="/${area}" data-nav class="module-nav__link${currentRoute.moduleId === "overview" ? " is-active" : ""}">Übersicht</a>
      ${routes.map((route) => `
        <a href="${route.path}" data-nav class="module-nav__link${currentRoute.path === route.path ? " is-active" : ""}">${escapeHtml(route.label)}</a>
      `).join("")}
    </nav>`;
}

function moduleOverview(area: Exclude<PortalArea, "public">): string {
  return `
    <section class="module-grid">
      ${moduleRoutesForArea(area).filter((route) => canAccessRoute(session, route)).map((route, index) => `
        <a href="${route.path}" data-nav class="module-card module-card--link">
          <span class="module-card__number">${String(index + 1).padStart(2, "0")}</span>
          <h2>${escapeHtml(route.label)}</h2>
          <p>Eigener Portalpfad ist vorbereitet und nutzt dieselbe rollen- und tenant-geschützte Platform Shell.</p>
          ${statusPill(index < 3 ? "FOUNDATION" : "NEXT", index < 3 ? "ready" : "next")}
        </a>
      `).join("")}
    </section>`;
}

function modulePlaceholder(route: PortalRoute): string {
  return `
    <section class="module-detail">
      <div class="eyebrow">MODULE ROUTE</div>
      <h2>${escapeHtml(route.label)}</h2>
      <p>Dieser Bereich hat jetzt einen stabilen, geschützten Portalpfad. Die Fachlogik wird in diesem Modul weiter ausgebaut, ohne eine separate App oder zweite Datenhaltung anzulegen.</p>
      ${statusPill("ROUTE READY")}
    </section>`;
}

async function protectedView(area: Exclude<PortalArea, "public">, route: PortalRoute): Promise<string> {
  const copy = areaCopy[area];
  if (!canAccessRoute(session, route)) {
    const loginTarget = `/login?next=${encodeURIComponent(route.path)}`;
    return `
      <main class="locked-view">
        <div class="locked-view__box">
          ${statusPill("PROTECTED AREA", "locked")}
          <div class="lock-icon">↗</div>
          <h1>${copy.title}</h1>
          <p>Dieser Bereich ist rollenbasiert geschützt. Melde dich mit deinem GMVGANG-Account an; Organization und Rollen werden anschließend ausschließlich serverseitig aus der verifizierten Session geladen.</p>
          <a href="${loginTarget}" data-nav class="button">Einloggen</a>
        </div>
      </main>`;
  }

  const heading = route.navigation === "module" ? route.label : copy.title;
  const intro = `
    <section class="workspace__intro">
      <div>
        <div class="eyebrow">${copy.eyebrow}</div>
        <h1>${escapeHtml(heading)}</h1>
        <p>${copy.description}</p>
      </div>
      ${statusPill(area === "brand" ? "TENANT BOUND" : "ROLE BOUNDARY ACTIVE")}
    </section>
    ${moduleNavigation(area, route)}`;

  if (
    area === "brand" &&
    session.status === "authenticated" &&
    session.organizationId &&
    ["overview", "profitability", "actions"].includes(route.moduleId ?? "")
  ) {
    const overview = await loadBrandOverview(session.organizationId, createBrandOverviewPort(session.organizationId));
    return `
      <main class="workspace">
        ${intro}
        ${renderBrandOverview(overview)}
        <section class="boundary-note">
          <strong>Tenant boundary</strong>
          <span>Brand-Daten werden nur akzeptiert, wenn die serverseitige Overview dieselbe Organization-ID wie die verifizierte Portal-Session trägt.</span>
        </section>
      </main>`;
  }

  if (area === "creator" && route.moduleId === "profile") {
    const creatorProfile = await new HttpCreatorProfileAdapter().getProfile();
    return `
      <main class="workspace">
        ${intro}
        ${renderCreatorProfile(creatorProfile)}
      </main>`;
  }

  if (area === "creator" && route.moduleId === "qualification") {
    const creatorProfile = await new HttpCreatorProfileAdapter().getProfile();
    if (!creatorProfile.ok) {
      return `
        <main class="workspace">
          ${intro}
          ${renderCreatorProfile(creatorProfile)}
        </main>`;
    }
    const qualification = await new HttpCreatorQualificationAdapter().getQualification();
    return `
      <main class="workspace">
        ${intro}
        ${renderCreatorQualification(
          creatorProfile.creatorProfile as unknown as Parameters<typeof renderCreatorQualification>[0],
          qualification,
        )}
        <section class="boundary-note">
          <strong>Account-bound qualification</strong>
          <span>R2 wird ausschließlich dem serverseitig verifizierten Creator-Profil des eingeloggten Accounts zugeordnet. Ein Browser kann keine fremde Creator-ID vorgeben.</span>
        </section>
      </main>`;
  }

  if (area === "creator" && route.moduleId === "referrals") {
    const referralHub = await new HttpCreatorReferralHubAdapter().getHub();
    return `
      <main class="workspace">
        ${intro}
        ${renderCreatorReferralHub(referralHub, window.location.origin)}
      </main>`;
  }

  if (area === "creator" && ["matches", "campaigns", "performance"].includes(route.moduleId ?? "")) {
    const workspace = await new HttpCreatorWorkspaceAdapter().getWorkspace();
    const content = route.moduleId === "matches"
      ? renderCreatorMatches(workspace)
      : route.moduleId === "campaigns"
        ? renderCreatorCampaigns(workspace)
        : renderCreatorPerformance(workspace);
    return `
      <main class="workspace">
        ${intro}
        ${content}
        <section class="boundary-note">
          <strong>Creator-safe read boundary</strong>
          <span>Nur dein serverseitig verknüpfter Creator-Datensatz wird gelesen. Nicht freigegebene Campaigns, interne Matching-Scores und operative Blocker werden nicht an den Browser übertragen.</span>
        </section>
      </main>`;
  }

  if (area === "team" && route.moduleId === "admin") {
    const admin = await new HttpTeamAdminAdapter().getOverview();
    return `
      <main class="workspace">
        ${intro}
        ${renderTeamAdmin(admin, session.status === "authenticated" ? session.roles : [])}
        <section class="boundary-note">
          <strong>Privileged boundary</strong>
          <span>Benutzer, Memberships und Audit-Daten werden ausschließlich nach serverseitiger users.manage-Prüfung ausgeliefert. Änderungen laufen über die bestehende autorisierte Membership-Mutation.</span>
        </section>
      </main>`;
  }

  if (area === "team" && ["creators", "activity"].includes(route.moduleId ?? "")) {
    const funnel = await new HttpTeamCreatorFunnelAdapter().getFunnel();
    const content = route.moduleId === "activity"
      ? renderTeamActivityTrail(funnel)
      : renderTeamCreatorOperations(funnel);
    return `
      <main class="workspace">
        ${intro}
        ${content}
        <section class="boundary-note">
          <strong>Internal data boundary</strong>
          <span>Creator-Funnel und Activity Trail werden ausschließlich über die serverseitige Capability creators.read_all ausgeliefert. URL-Zugriff allein reicht nicht.</span>
        </section>
      </main>`;
  }

  return `
    <main class="workspace">
      ${intro}
      ${route.moduleId === "overview" ? moduleOverview(area) : modulePlaceholder(route)}
      <section class="boundary-note">
        <strong>Security boundary</strong>
        <span>Jeder Modulpfad erbt dieselbe Role- und Tenant-Grenze der gemeinsamen Platform Shell; URL-Pfade selbst verleihen keine Berechtigung.</span>
      </section>
    </main>`;
}

function wireNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = new URL(link.href);
      const workspaceId = selectedWorkspaceId();
      if (workspaceId && url.pathname !== "/login") url.searchParams.set("workspace", workspaceId);
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

function wireSignOut(): void {
  const button = document.querySelector<HTMLButtonElement>("#sign-out");
  button?.addEventListener("click", async () => {
    button.disabled = true;
    const result = await signOut();
    if (!result.ok) {
      button.disabled = false;
      return;
    }
    window.history.pushState({}, "", "/");
    await render();
  });
}

async function render(): Promise<void> {
  const requestedWorkspaceId = selectedWorkspaceId();
  session = await createSessionPort(requestedWorkspaceId).getSession();
  workspaces = session.status === "authenticated" ? await createWorkspacePort().getWorkspaces() : [];

  let route = resolvePortalRoute(window.location.pathname);
  if (route.path === "/join" && canAccessArea(session, "creator")) {
    window.history.replaceState({}, "", "/creator");
    route = resolvePortalRoute("/creator");
  }

  const referralCode = new URLSearchParams(window.location.search).get("ref") ?? undefined;
  const privacyNoticeVersion = String(import.meta.env.VITE_CREATOR_PRIVACY_NOTICE_VERSION ?? "").trim();
  const body = route.path === "/login"
    ? renderLogin(session.status === "authenticated")
    : route.path === "/join"
      ? renderCreatorJoin(session, { privacyNoticeVersion, ...(referralCode ? { referralCode } : {}) })
      : route.area === "public"
        ? publicView()
        : await protectedView(route.area, route);

  app.innerHTML = `${navigation()}${body}<footer><span>GMVGANG</span><span>Portal</span></footer>`;
  wireNavigation();
  wireWorkspaceSelector();
  wireSignOut();
  if (route.path === "/login") wireLogin();
  if (route.path === "/join") wireCreatorJoin(new HttpCreatorRegistrationAdapter());
  if (route.path === "/creator/profile") wireCreatorProfile(new HttpCreatorProfileAdapter());
  if (route.path === "/creator/qualification") wireCreatorQualification(new HttpCreatorQualificationAdapter());
  if (route.path === "/creator/referrals") wireCreatorReferralHub();
  if (route.path === "/team/admin") wireTeamAdmin(new HttpTeamAdminAdapter(), () => render());
}

window.addEventListener("popstate", () => void render());
void render();
