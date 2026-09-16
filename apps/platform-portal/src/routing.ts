import { anyRoleHasCapability, type PlatformCapability } from "@gmvgang/platform-foundation";
import type { PortalSession } from "./session.js";

export type PortalArea = "public" | "creator" | "brand" | "team";

export interface PortalRoute {
  path: string;
  area: PortalArea;
  label: string;
}

export const PORTAL_ROUTES: readonly PortalRoute[] = [
  { path: "/", area: "public", label: "Start" },
  { path: "/join", area: "public", label: "Creator Join" },
  { path: "/login", area: "public", label: "Login" },
  { path: "/creator", area: "creator", label: "Creator Portal" },
  { path: "/brand", area: "brand", label: "Brand Portal" },
  { path: "/team", area: "team", label: "Team Workspace" },
];

const AREA_CAPABILITY: Record<Exclude<PortalArea, "public">, PlatformCapability> = {
  creator: "creator.portal.access",
  brand: "brand.portal.access",
  team: "team.workspace.read",
};

export function resolvePortalRoute(pathname: string): PortalRoute {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return PORTAL_ROUTES.find((route) => route.path === normalized) ?? PORTAL_ROUTES[0]!;
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
