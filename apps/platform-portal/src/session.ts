import type { PlatformSession, PlatformUserRole } from "@gmvgang/platform-foundation";

export type PortalSession = PlatformSession;

export interface SessionPort {
  getSession(): Promise<PortalSession>;
}

export type SessionHttpResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type SessionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: { Accept: "application/json" };
  },
) => Promise<SessionHttpResponse>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePortalSession(payload: unknown): PortalSession {
  if (!isRecord(payload)) {
    throw new Error("SESSION_PAYLOAD_INVALID");
  }

  if (payload.status === "anonymous") {
    return { status: "anonymous", roles: [] };
  }

  if (payload.status !== "authenticated") {
    throw new Error("SESSION_STATUS_INVALID");
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (!userId || !Array.isArray(payload.roles) || !payload.roles.every((role) => typeof role === "string" && isPlatformRole(role))) {
    throw new Error("SESSION_IDENTITY_INVALID");
  }

  const roles = [...new Set(payload.roles as PlatformUserRole[])];
  const organizationId = typeof payload.organizationId === "string" ? payload.organizationId.trim() : "";

  if (roles.length > 0 && !organizationId) {
    throw new Error("SESSION_TENANT_REQUIRED");
  }

  return {
    status: "authenticated",
    userId,
    ...(organizationId ? { organizationId } : {}),
    roles,
  };
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
    if (!organizationId) {
      return { status: "anonymous", roles: [] };
    }

    return {
      status: "authenticated",
      userId: "dev-user",
      organizationId,
      roles: [role],
    };
  }
}

export class HttpSessionAdapter implements SessionPort {
  constructor(
    private readonly endpoint = "/api/session",
    private readonly fetchSession: SessionFetch = (input, init) => fetch(input, init),
  ) {}

  async getSession(): Promise<PortalSession> {
    try {
      const response = await this.fetchSession(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return { status: "anonymous", roles: [] };
      }

      return parsePortalSession(await response.json());
    } catch {
      return { status: "anonymous", roles: [] };
    }
  }
}

export function createSessionPort(): SessionPort {
  return import.meta.env.DEV ? new EnvironmentSessionAdapter() : new HttpSessionAdapter();
}
