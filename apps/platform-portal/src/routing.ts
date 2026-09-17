import { anyRoleHasCapability, type PlatformCapability } from "@gmvgang/platform-foundation";
import type { PortalSession } from "./session.js";

export type PortalArea = "public" | "creator" | "brand" | "team";
export type PortalNavigation = "primary" | "module" | "hidden";

export interface PortalRoute {
  path: string;
  area: PortalArea;
  label: string;
  navigation: PortalNavigation;
  moduleId?: string;
}

export const PORTAL_ROUTES: readonly PortalRoute[] = [
  { path: "/", area: "public", label: "Start", navigation: "primary" },
  { path: "/join", area: "public", label: "Creator Join", navigation: "primary" },
  { path: "/login", area: "public", label: "Login", navigation: "primary" },

  { path: "/creator", area: "creator", label: "Creator Portal", navigation: "primary", moduleId: "overview" },
  { path: "/creator/profile", area: "creator", label: "Profil", navigation: "module", moduleId: "profile" },
  { path: "/creator/qualification", area: "creator", label: "Qualifizierung", navigation: "module", moduleId: "qualification" },
  { path: "/creator/referrals", area: "creator", label: "Referral Hub", navigation: "module", moduleId: "referrals" },
  { path: "/creator/matches", area: "creator", label: "Matches", navigation: "module", moduleId: "matches" },
  { path: "/creator/campaigns", area: "creator", label: "Campaigns", navigation: "module", moduleId: "campaigns" },
  { path: "/creator/performance", area: "creator", label: "Performance", navigation: "module", moduleId: "performance" },

  { path: "/brand", area: "brand", label: "Brand Portal", navigation: "primary", moduleId: "overview" },
  { path: "/brand/profitability", area: "brand", label: "Profitability", navigation: "module", moduleId: "profitability" },
  { path: "/brand/actions", area: "brand", label: "Next Best Actions", navigation: "module", moduleId: "actions" },
  { path: "/brand/campaigns", area: "brand", label: "Campaigns", navigation: "module", moduleId: "campaigns" },
  { path: "/brand/creators", area: "brand", label: "Creator Intelligence", navigation: "module", moduleId: "creators" },
  { path: "/brand/approvals", area: "brand", label: "Approvals", navigation: "module", moduleId: "approvals" },
  { path: "/brand/reporting", area: "brand", label: "Reporting", navigation: "module", moduleId: "reporting" },

  { path: "/team", area: "team", label: "Team Workspace", navigation: "primary", moduleId: "overview" },
  { path: "/team/creators", area: "team", label: "Creator Operations", navigation: "module", moduleId: "creators" },
  { path: "/team/brands", area: "team", label: "Brand Operations", navigation: "module", moduleId: "brands" },
  { path: "/team/campaigns", area: "team", label: "Campaign Control", navigation: "module", moduleId: "campaigns" },
  { path: "/team/approvals", area: "team", label: "Approval Center", navigation: "module", moduleId: "approvals" },
  { path: "/team/risk", area: "team", label: "Risk & Alerts", navigation: "module", moduleId: "risk" },
  { path: "/team/activity", area: "team", label: "Activity Trail", navigation: "module", moduleId: "activity" },
];

export const PRIMARY_PORTAL_ROUTES: readonly PortalRoute[] = PORTAL_ROUTES.filter(
  (route) => route.navigation === "primary",
);

const AREA_CAPABILITY: Record<Exclude<PortalArea, "public">, PlatformCapability> = {
  creator: "creator.portal.access",
  brand: "brand.portal.access",
  team: "team.workspace.read",
};

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function resolvePortalRoute(pathname: string): PortalRoute {
  const normalized = normalizePath(pathname);
  return PORTAL_ROUTES.find((route) => route.path === normalized) ?? PORTAL_ROUTES[0]!;
}

export function moduleRoutesForArea(area: Exclude<PortalArea, "public">): readonly PortalRoute[] {
  return PORTAL_ROUTES.filter((route) => route.area === area && route.navigation === "module");
}

export function canAccessArea(session: PortalSession, area: PortalArea): boolean {
  if (area === "public") return true;
  if (session.status !== "authenticated") return false;
  return anyRoleHasCapability(session.roles, AREA_CAPABILITY[area]);
}

export function defaultAreaForSession(session: PortalSession): PortalArea {
  if (session.status !== "authenticated") return "public";
  if (canAccessArea(session, "team")) return "team";
  if (canAccessArea(session, "brand")) return "brand";
  if (canAccessArea(session, "creator")) return "creator";
  return "public";
}
