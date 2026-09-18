export type BrandCompanyStatus =
  | "lead"
  | "qualified"
  | "onboarding"
  | "active"
  | "paused"
  | "churned";

export type BrandTeamMemberStatus = "invited" | "active";

export type BrandCompanyTeamResponse = {
  organization: {
    id: string;
    type: "brand";
    name: string;
    status: "active";
  };
  profile: {
    organizationId: string;
    legalName: string | null;
    website: string | null;
    status: BrandCompanyStatus;
  };
  members: Array<{
    membershipId: string;
    organizationId: string;
    email: string;
    displayName: string | null;
    role: "brand_member";
    status: BrandTeamMemberStatus;
    createdAt: string;
    updatedAt: string;
  }>;
};

export interface BrandCompanyTeamPort {
  getCompanyTeam(): Promise<BrandCompanyTeamResponse | null>;
}

type CompanyTeamFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const BRAND_STATUSES = new Set<BrandCompanyStatus>([
  "lead",
  "qualified",
  "onboarding",
  "active",
  "paused",
  "churned",
]);

const MEMBER_STATUSES = new Set<BrandTeamMemberStatus>([
  "invited",
  "active",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function requiredText(
  value: unknown,
  maxLength: number,
  code: string,
): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(code);
  return cleaned;
}

function optionalText(
  value: unknown,
  maxLength: number,
  code: string,
): string | null {
  if (value === null) return null;
  return requiredText(value, maxLength, code);
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_COMPANY_TEAM_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

function email(value: unknown): string {
  const cleaned = requiredText(
    value,
    320,
    "BRAND_COMPANY_TEAM_EMAIL_INVALID",
  ).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new Error("BRAND_COMPANY_TEAM_EMAIL_INVALID");
  }
  return cleaned;
}

function website(value: unknown): string | null {
  if (value === null) return null;
  const raw = requiredText(
    value,
    2048,
    "BRAND_COMPANY_TEAM_WEBSITE_INVALID",
  );
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("BRAND_COMPANY_TEAM_WEBSITE_INVALID");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("BRAND_COMPANY_TEAM_WEBSITE_INVALID");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function parseBrandCompanyTeam(
  payload: unknown,
): BrandCompanyTeamResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["organization", "profile", "members"]) ||
    !isRecord(payload.organization) ||
    !isRecord(payload.profile) ||
    !Array.isArray(payload.members)
  ) {
    throw new Error("BRAND_COMPANY_TEAM_PAYLOAD_INVALID");
  }

  if (
    !hasOnlyKeys(payload.organization, ["id", "type", "name", "status"]) ||
    payload.organization.type !== "brand" ||
    payload.organization.status !== "active"
  ) {
    throw new Error("BRAND_COMPANY_TEAM_ORGANIZATION_INVALID");
  }

  const organizationId = requiredText(
    payload.organization.id,
    128,
    "BRAND_COMPANY_TEAM_ORGANIZATION_INVALID",
  );

  if (
    !hasOnlyKeys(payload.profile, [
      "organizationId",
      "legalName",
      "website",
      "status",
    ]) ||
    typeof payload.profile.status !== "string" ||
    !BRAND_STATUSES.has(payload.profile.status as BrandCompanyStatus)
  ) {
    throw new Error("BRAND_COMPANY_TEAM_PROFILE_INVALID");
  }

  const profileOrganizationId = requiredText(
    payload.profile.organizationId,
    128,
    "BRAND_COMPANY_TEAM_PROFILE_INVALID",
  );
  if (profileOrganizationId !== organizationId) {
    throw new Error("BRAND_COMPANY_TEAM_TENANT_MISMATCH");
  }

  const seenMembershipIds = new Set<string>();
  const members = payload.members.map((raw) => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "membershipId",
        "organizationId",
        "email",
        "displayName",
        "role",
        "status",
        "createdAt",
        "updatedAt",
      ]) ||
      raw.role !== "brand_member" ||
      typeof raw.status !== "string" ||
      !MEMBER_STATUSES.has(raw.status as BrandTeamMemberStatus)
    ) {
      throw new Error("BRAND_COMPANY_TEAM_MEMBER_INVALID");
    }

    const membershipId = requiredText(
      raw.membershipId,
      128,
      "BRAND_COMPANY_TEAM_MEMBER_INVALID",
    );
    if (seenMembershipIds.has(membershipId)) {
      throw new Error("BRAND_COMPANY_TEAM_DUPLICATE_MEMBER");
    }
    seenMembershipIds.add(membershipId);

    const memberOrganizationId = requiredText(
      raw.organizationId,
      128,
      "BRAND_COMPANY_TEAM_MEMBER_INVALID",
    );
    if (memberOrganizationId !== organizationId) {
      throw new Error("BRAND_COMPANY_TEAM_TENANT_MISMATCH");
    }

    const createdAt = timestamp(raw.createdAt);
    const updatedAt = timestamp(raw.updatedAt);
    if (Date.parse(updatedAt) < Date.parse(createdAt)) {
      throw new Error("BRAND_COMPANY_TEAM_TIMESTAMP_INVALID");
    }

    return {
      membershipId,
      organizationId: memberOrganizationId,
      email: email(raw.email),
      displayName: optionalText(
        raw.displayName,
        160,
        "BRAND_COMPANY_TEAM_MEMBER_INVALID",
      ),
      role: "brand_member" as const,
      status: raw.status as BrandTeamMemberStatus,
      createdAt,
      updatedAt,
    };
  });

  return {
    organization: {
      id: organizationId,
      type: "brand",
      name: requiredText(
        payload.organization.name,
        256,
        "BRAND_COMPANY_TEAM_ORGANIZATION_INVALID",
      ),
      status: "active",
    },
    profile: {
      organizationId: profileOrganizationId,
      legalName: optionalText(
        payload.profile.legalName,
        256,
        "BRAND_COMPANY_TEAM_PROFILE_INVALID",
      ),
      website: website(payload.profile.website),
      status: payload.profile.status as BrandCompanyStatus,
    },
    members,
  };
}

export class HttpBrandCompanyTeamAdapter implements BrandCompanyTeamPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/company-team",
    private readonly request: CompanyTeamFetch = (input, init) =>
      fetch(input, init),
  ) {}

  async getCompanyTeam(): Promise<BrandCompanyTeamResponse | null> {
    if (!this.organizationId.trim()) return null;
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": this.organizationId,
        },
      });
      if (!response.ok) return null;
      const parsed = parseBrandCompanyTeam(await response.json());
      return parsed.organization.id === this.organizationId ? parsed : null;
    } catch {
      return null;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const STATUS_LABELS: Record<BrandCompanyStatus, string> = {
  lead: "Lead",
  qualified: "Qualifiziert",
  onboarding: "Onboarding",
  active: "Aktiv",
  paused: "Pausiert",
  churned: "Beendet",
};

const MEMBER_STATUS_LABELS: Record<BrandTeamMemberStatus, string> = {
  invited: "Eingeladen",
  active: "Aktiv",
};

export function renderBrandCompanyTeam(
  response: BrandCompanyTeamResponse | null,
): string {
  if (!response) {
    return `<section class="brand-company-team brand-company-team--empty"><span class="eyebrow">UNTERNEHMEN & TEAM</span><h2>Workspace-Daten nicht verfügbar</h2><p>Company- und Teamdaten werden erst angezeigt, wenn der serverseitige Brand-Kontext sicher gelesen werden kann.</p></section>`;
  }

  const websiteLink = response.profile.website
    ? `<a href="${escapeHtml(response.profile.website)}" target="_blank" rel="noopener noreferrer">Website öffnen</a>`
    : "<span>Keine Website hinterlegt</span>";

  const activeCount = response.members.filter(
    (member) => member.status === "active",
  ).length;
  const invitedCount = response.members.filter(
    (member) => member.status === "invited",
  ).length;

  const members = response.members.length
    ? response.members.map((member) => `<article class="brand-company-team__member">
      <div><strong>${escapeHtml(member.displayName ?? member.email)}</strong><span>${escapeHtml(member.email)}</span></div>
      <span class="brand-company-team__member-status">${escapeHtml(MEMBER_STATUS_LABELS[member.status])}</span>
    </article>`).join("")
    : `<p class="brand-company-team__empty-state">Noch keine aktiven oder eingeladenen Brand-Mitglieder.</p>`;

  return `<section class="brand-company-team">
    <div class="brand-company-team__header">
      <div><span class="eyebrow">UNTERNEHMEN & TEAM</span><h2>${escapeHtml(response.organization.name)}</h2><p>${escapeHtml(response.profile.legalName ?? "Kein rechtlicher Firmenname hinterlegt")}</p></div>
      <span class="brand-company-team__status">${escapeHtml(STATUS_LABELS[response.profile.status])}</span>
    </div>
    <div class="brand-company-team__company">
      <div><span>Workspace</span><strong>Brand</strong></div>
      <div><span>Website</span>${websiteLink}</div>
      <div><span>Team</span><strong>${activeCount} aktiv · ${invitedCount} eingeladen</strong></div>
    </div>
    <div class="brand-company-team__team">
      <div><h3>Team</h3><p>Mitgliedschaften werden serverseitig über die bestehende Membership-Governance verwaltet.</p></div>
      <div class="brand-company-team__members">${members}</div>
    </div>
  </section>`;
}
