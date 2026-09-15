import type { PlatformUserRole } from "@gmvgang/platform-foundation";
import type { PortalSession } from "./session.js";

export type PortalArea = "public" | "creator" | "brand" | "team";

export interface PortalRoute {
  path: string;
  area: PortalArea;
  label: string;
}

export const PORTAL_ROUTES: readonly PortalRoute[] = [
  { path: "/", area: "public", label: "Start" },
  { path: "/creator", area: "creator", label: "Creator Portal" },
  { path: "/brand", area: "brand", label: "Brand Portal" },
  { path: "/team", area: "team", label: "Team Workspace" },
];

const INTERNAL_ROLES: readonly PlatformUserRole[] = ["founder", "admin", "creator_manager", "brand_manager", "closer"];

export function resolvePortalRoute(pathname: string): PortalRoute {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return PORTAL_ROUTES.find((route) => route.path === normalized) ?? PORTAL_ROUTES[0]!;
}

export function canAccessArea(session: PortalSession, area: PortalArea): boolean {
  if (area === "public") return true;
  if (session.status !== "authenticated") return false;

  if (area === "creator") return session.roles.includes("creator");
  if (area === "brand") return session.roles.includes("brand_member");
  return session.roles.some((role) => INTERNAL_ROLES.includes(role));
}

export function defaultAreaForSession(session: PortalSession): PortalArea {
  if (session.status !== "authenticated") return "public";
  if (session.roles.some((role) => INTERNAL_ROLES.includes(role))) return "team";
  if (session.roles.includes("brand_member")) return "brand";
  if (session.roles.includes("creator")) return "creator";
  return "public";
}
