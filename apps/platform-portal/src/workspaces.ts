import type { OrganizationType, PlatformUserRole, PlatformWorkspaceAccess } from "@gmvgang/platform-foundation";

export interface WorkspacePort {
  getWorkspaces(): Promise<readonly PlatformWorkspaceAccess[]>;
}

export type WorkspaceHttpResponse = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type WorkspaceFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: { Accept: "application/json" };
  },
) => Promise<WorkspaceHttpResponse>;

const PLATFORM_ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];

const ORGANIZATION_TYPES: readonly OrganizationType[] = ["gmvgang", "brand"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlatformRole(value: unknown): value is PlatformUserRole {
  return typeof value === "string" && PLATFORM_ROLES.includes(value as PlatformUserRole);
}

function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === "string" && ORGANIZATION_TYPES.includes(value as OrganizationType);
}

export function parsePortalWorkspaces(payload: unknown): PlatformWorkspaceAccess[] {
  if (!Array.isArray(payload)) {
    throw new Error("WORKSPACES_PAYLOAD_INVALID");
  }

  return payload.map((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.organizationId !== "string" ||
      !candidate.organizationId.trim() ||
      !isOrganizationType(candidate.organizationType) ||
      typeof candidate.name !== "string" ||
      !candidate.name.trim() ||
      !Array.isArray(candidate.roles) ||
      candidate.roles.length === 0 ||
      !candidate.roles.every(isPlatformRole)
    ) {
      throw new Error("WORKSPACE_INVALID");
    }

    return {
      organizationId: candidate.organizationId.trim(),
      organizationType: candidate.organizationType,
      name: candidate.name.trim(),
      roles: [...new Set(candidate.roles as PlatformUserRole[])],
    };
  });
}

export class HttpWorkspaceAdapter implements WorkspacePort {
  constructor(
    private readonly endpoint = "/api/workspaces",
    private readonly fetchWorkspaces: WorkspaceFetch = (input, init) => fetch(input, init),
  ) {}

  async getWorkspaces(): Promise<readonly PlatformWorkspaceAccess[]> {
    try {
      const response = await this.fetchWorkspaces(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];
      return parsePortalWorkspaces(await response.json());
    } catch {
      return [];
    }
  }
}

export function createWorkspacePort(): WorkspacePort {
  return new HttpWorkspaceAdapter();
}
