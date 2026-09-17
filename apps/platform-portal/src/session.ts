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
    headers: Record<string, string>;
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const organizationId = typeof payload.organizationId === "string" ? payload.organizationId.trim() : "";

  if (roles.length > 0 && !organizationId) {
    throw new Error("SESSION_TENANT_REQUIRED");
  }

  return {
    status: "authenticated",
    userId,
    ...(email ? { email } : {}),
    ...(organizationId ? { organizationId } : {}),
    roles,
  };
}

export class HttpSessionAdapter implements SessionPort {
  constructor(
    private readonly endpoint = "/api/session",
    private readonly fetchSession: SessionFetch = (input, init) => fetch(input, init),
    private readonly requestedOrganizationId?: string,
  ) {}

  async getSession(): Promise<PortalSession> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.requestedOrganizationId) {
      headers["X-GMVGANG-Organization-Id"] = this.requestedOrganizationId;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchSession(this.endpoint, {
          credentials: "include",
          cache: "no-store",
          headers,
        });

        if (!response.ok) {
          if (attempt === 0) {
            await wait(350);
            continue;
          }
          return { status: "anonymous", roles: [] };
        }

        return parsePortalSession(await response.json());
      } catch {
        if (attempt === 0) {
          await wait(350);
          continue;
        }
        return { status: "anonymous", roles: [] };
      }
    }

    return { status: "anonymous", roles: [] };
  }
}

export class EnvironmentSessionAdapter implements SessionPort {
  constructor(private readonly requestedOrganizationId?: string) {}

  async getSession(): Promise<PortalSession> {
    if (!import.meta.env.DEV) {
      return new HttpSessionAdapter("/api/session", undefined, this.requestedOrganizationId).getSession();
    }

    const role = String(import.meta.env.VITE_PLATFORM_DEV_ROLE ?? "").trim();
    if (!role || !isPlatformRole(role)) {
      return { status: "anonymous", roles: [] };
    }

    const organizationId = String(import.meta.env.VITE_PLATFORM_DEV_ORGANIZATION_ID ?? "").trim();
    if (!organizationId || (this.requestedOrganizationId && this.requestedOrganizationId !== organizationId)) {
      return { status: "anonymous", roles: [] };
    }

    return {
      status: "authenticated",
      userId: "dev-user",
      email: "dev@gmvgang.local",
      organizationId,
      roles: [role],
    };
  }
}

export function createSessionPort(requestedOrganizationId?: string): SessionPort {
  return import.meta.env.DEV
    ? new EnvironmentSessionAdapter(requestedOrganizationId)
    : new HttpSessionAdapter("/api/session", undefined, requestedOrganizationId);
}
