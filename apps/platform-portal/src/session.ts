import type { PlatformUserRole } from "@gmvgang/platform-foundation";

export type PortalSession =
  | {
      status: "anonymous";
      roles: readonly [];
    }
  | {
      status: "authenticated";
      userId: string;
      organizationId?: string;
      roles: readonly PlatformUserRole[];
    };

export interface SessionPort {
  getSession(): Promise<PortalSession>;
}

const PLATFORM_ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];

function isPlatformRole(value: string): value is PlatformUserRole {
  return PLATFORM_ROLES.includes(value as PlatformUserRole);
}

export class EnvironmentSessionAdapter implements SessionPort {
  async getSession(): Promise<PortalSession> {
    if (!import.meta.env.DEV) {
      return { status: "anonymous", roles: [] };
    }

    const role = String(import.meta.env.VITE_PLATFORM_DEV_ROLE ?? "").trim();
    if (!role || !isPlatformRole(role)) {
      return { status: "anonymous", roles: [] };
    }

    const organizationId = String(import.meta.env.VITE_PLATFORM_DEV_ORGANIZATION_ID ?? "").trim();

    return {
      status: "authenticated",
      userId: "dev-user",
      ...(organizationId ? { organizationId } : {}),
      roles: [role],
    };
  }
}
