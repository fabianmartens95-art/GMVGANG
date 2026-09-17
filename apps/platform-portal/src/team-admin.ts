import { capabilitiesForRole, type PlatformUserRole } from "@gmvgang/platform-foundation";

export type TeamAdminMembership = {
  id: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationType: "gmvgang" | "brand";
  role: PlatformUserRole;
  status: "invited" | "active" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type TeamAdminUser = {
  id: string;
  email: string | null;
  status: "pending" | "active" | "suspended" | "disabled";
  isTestAccount: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: TeamAdminMembership[];
};

export type TeamAdminAuditEvent = {
  id: string;
  event: string;
  userId: string | null;
  organizationId: string | null;
  occurredAt: string;
  metadata: Readonly<Record<string, unknown>>;
};

export type TeamAdminModel = {
  generatedAt: string;
  summary: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    disabledUsers: number;
    memberships: number;
    recentAuditEvents: number;
  };
  users: TeamAdminUser[];
  auditEvents: TeamAdminAuditEvent[];
};

export type TeamAdminState =
  | { ok: true; model: TeamAdminModel }
  | { ok: false; error: string };

const ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRole(value: unknown): value is PlatformUserRole {
  return typeof value === "string" && ROLES.includes(value as PlatformUserRole);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseMembership(value: unknown): TeamAdminMembership | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.organizationId !== "string" ||
    typeof value.organizationName !== "string" ||
    (value.organizationType !== "gmvgang" && value.organizationType !== "brand") ||
    !isRole(value.role) ||
    !["invited", "active", "revoked"].includes(String(value.status)) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) return null;

  return {
    id: value.id,
    userId: value.userId,
    organizationId: value.organizationId,
    organizationName: value.organizationName,
    organizationType: value.organizationType,
    role: value.role,
    status: value.status as TeamAdminMembership["status"],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseUser(value: unknown): TeamAdminUser | null {
  if (!isRecord(value) || !Array.isArray(value.memberships)) return null;
  if (
    typeof value.id !== "string" ||
    (value.email !== null && typeof value.email !== "string") ||
    !["pending", "active", "suspended", "disabled"].includes(String(value.status)) ||
    typeof value.isTestAccount !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) return null;

  const memberships = value.memberships.map(parseMembership);
  if (memberships.some((membership) => membership === null)) return null;

  return {
    id: value.id,
    email: value.email as string | null,
    status: value.status as TeamAdminUser["status"],
    isTestAccount: value.isTestAccount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    memberships: memberships as TeamAdminMembership[],
  };
}

function parseAudit(value: unknown): TeamAdminAuditEvent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.event !== "string" ||
    (value.userId !== null && typeof value.userId !== "string") ||
    (value.organizationId !== null && typeof value.organizationId !== "string") ||
    typeof value.occurredAt !== "string" ||
    !isRecord(value.metadata)
  ) return null;

  return {
    id: value.id,
    event: value.event,
    userId: value.userId as string | null,
    organizationId: value.organizationId as string | null,
    occurredAt: value.occurredAt,
    metadata: value.metadata,
  };
}

export function parseTeamAdminResponse(payload: unknown): TeamAdminModel {
  if (!isRecord(payload) || !isRecord(payload.model)) throw new Error("TEAM_ADMIN_PAYLOAD_INVALID");
  const model = payload.model;
  if (!isRecord(model.summary) || !Array.isArray(model.users) || !Array.isArray(model.auditEvents)) {
    throw new Error("TEAM_ADMIN_MODEL_INVALID");
  }
  const users = model.users.map(parseUser);
  const auditEvents = model.auditEvents.map(parseAudit);
  if (users.some((user) => user === null) || auditEvents.some((event) => event === null)) {
    throw new Error("TEAM_ADMIN_ITEMS_INVALID");
  }

  const summary = model.summary;
  const numericKeys = [
    "totalUsers",
    "activeUsers",
    "suspendedUsers",
    "disabledUsers",
    "memberships",
    "recentAuditEvents",
  ] as const;
  if (
    typeof model.generatedAt !== "string" ||
    numericKeys.some((key) => typeof summary[key] !== "number")
  ) {
    throw new Error("TEAM_ADMIN_SUMMARY_INVALID");
  }

  return {
    generatedAt: model.generatedAt,
    summary: {
      totalUsers: summary.totalUsers as number,
      activeUsers: summary.activeUsers as number,
      suspendedUsers: summary.suspendedUsers as number,
      disabledUsers: summary.disabledUsers as number,
      memberships: summary.memberships as number,
      recentAuditEvents: summary.recentAuditEvents as number,
    },
    users: users as TeamAdminUser[],
    auditEvents: auditEvents as TeamAdminAuditEvent[],
  };
}

export class HttpTeamAdminAdapter {
  constructor(
    private readonly overviewEndpoint = "/api/team/admin",
    private readonly membershipEndpoint = "/api/memberships",
  ) {}

  async getOverview(): Promise<TeamAdminState> {
    try {
      const response = await fetch(this.overviewEndpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return { ok: false, error: response.status === 403 ? "access_denied" : "load_failed" };
      return { ok: true, model: parseTeamAdminResponse(await response.json()) };
    } catch {
      return { ok: false, error: "load_failed" };
    }
  }

  async setMembership(input: {
    targetUserId: string;
    organizationId: string;
    role: PlatformUserRole;
    status: "active" | "revoked";
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const response = await fetch(this.membershipEndpoint, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const error = isRecord(payload) ? asString(payload.error) : null;
        return { ok: false, error: error ?? "membership_update_failed" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "membership_update_failed" };
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

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return escapeHtml(value);
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function roleLabel(role: PlatformUserRole): string {
  return role.replaceAll("_", " ");
}

function membershipMarkup(
  membership: TeamAdminMembership,
  actorRoles: readonly PlatformUserRole[],
): string {
  const founderProtected = membership.role === "founder";
  const adminProtected = membership.role === "admin" && !actorRoles.includes("founder");
  const canManage = !founderProtected && !adminProtected;
  const nextStatus: "active" | "revoked" = membership.status === "active" ? "revoked" : "active";
  const actionLabel = nextStatus === "revoked" ? "Entziehen" : "Aktivieren";

  return `
    <div class="admin-membership">
      <div>
        <strong>${escapeHtml(roleLabel(membership.role))}</strong>
        <span>${escapeHtml(membership.organizationName)} · ${escapeHtml(membership.status)}</span>
      </div>
      ${canManage
        ? `<button
            type="button"
            class="admin-action"
            data-membership-action
            data-user-id="${escapeHtml(membership.userId)}"
            data-organization-id="${escapeHtml(membership.organizationId)}"
            data-role="${escapeHtml(membership.role)}"
            data-status="${nextStatus}"
          >${actionLabel}</button>`
        : '<span class="admin-protected">geschützt</span>'}
    </div>`;
}

function metadataMarkup(metadata: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(metadata);
  if (!entries.length) return "";
  return `<code>${escapeHtml(JSON.stringify(metadata))}</code>`;
}

export function renderTeamAdmin(
  state: TeamAdminState,
  actorRoles: readonly PlatformUserRole[],
): string {
  if (!state.ok) {
    return `
      <section class="admin-state admin-state--error">
        <strong>Security Center nicht verfügbar</strong>
        <span>${state.error === "access_denied" ? "Dieser Account besitzt keine Benutzerverwaltungs-Berechtigung." : "Die Admin-Daten konnten nicht geladen werden."}</span>
      </section>`;
  }

  const { model } = state;
  return `
    <section class="admin-summary" aria-label="Security Center Kennzahlen">
      <article><span>Accounts</span><strong>${model.summary.totalUsers}</strong></article>
      <article><span>Aktiv</span><strong>${model.summary.activeUsers}</strong></article>
      <article><span>Gesperrt</span><strong>${model.summary.suspendedUsers + model.summary.disabledUsers}</strong></article>
      <article><span>Memberships</span><strong>${model.summary.memberships}</strong></article>
      <article><span>Audit Events</span><strong>${model.summary.recentAuditEvents}</strong></article>
    </section>

    <section class="admin-panel">
      <div class="admin-panel__header">
        <div>
          <div class="eyebrow">IDENTITY & ACCESS</div>
          <h2>Benutzer und Rollen</h2>
        </div>
        <span>Stand ${formatDate(model.generatedAt)}</span>
      </div>
      <div id="admin-feedback" class="admin-feedback" aria-live="polite"></div>
      <div class="admin-users">
        ${model.users.map((user) => `
          <article class="admin-user">
            <div class="admin-user__identity">
              <strong>${escapeHtml(user.email ?? user.id)}</strong>
              <span>${escapeHtml(user.status)}${user.isTestAccount ? " · Testaccount" : ""}</span>
              <small>${escapeHtml(user.id)}</small>
            </div>
            <div class="admin-user__memberships">
              ${user.memberships.length
                ? user.memberships.map((membership) => membershipMarkup(membership, actorRoles)).join("")
                : '<span class="admin-empty">Keine Membership</span>'}
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="admin-panel">
      <div class="admin-panel__header">
        <div>
          <div class="eyebrow">CAPABILITY MATRIX</div>
          <h2>Rollen → Berechtigungen</h2>
        </div>
        <span>server-authoritativ</span>
      </div>
      <div class="capability-grid">
        ${ROLES.map((role) => `
          <article class="capability-card">
            <strong>${escapeHtml(roleLabel(role))}</strong>
            <div>
              ${capabilitiesForRole(role).map((capability) =>
                `<span>${escapeHtml(capability)}</span>`
              ).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="admin-panel">
      <div class="admin-panel__header">
        <div>
          <div class="eyebrow">AUDIT TRAIL</div>
          <h2>Letzte sicherheitsrelevante Ereignisse</h2>
        </div>
        <span>append-only</span>
      </div>
      <div class="admin-audit">
        ${model.auditEvents.map((event) => `
          <article>
            <div>
              <strong>${escapeHtml(event.event)}</strong>
              <span>${formatDate(event.occurredAt)}</span>
            </div>
            <small>${event.userId ? `User ${escapeHtml(event.userId)}` : "System"}${event.organizationId ? ` · Org ${escapeHtml(event.organizationId)}` : ""}</small>
            ${metadataMarkup(event.metadata)}
          </article>
        `).join("") || '<span class="admin-empty">Noch keine Audit Events vorhanden.</span>'}
      </div>
    </section>`;
}

export function wireTeamAdmin(
  adapter: HttpTeamAdminAdapter,
  onChanged: () => void | Promise<void>,
): void {
  const feedback = document.querySelector<HTMLDivElement>("#admin-feedback");
  document.querySelectorAll<HTMLButtonElement>("[data-membership-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetUserId = button.dataset.userId?.trim() ?? "";
      const organizationId = button.dataset.organizationId?.trim() ?? "";
      const role = button.dataset.role;
      const status = button.dataset.status;
      if (!targetUserId || !organizationId || !isRole(role) || (status !== "active" && status !== "revoked")) return;

      button.disabled = true;
      if (feedback) feedback.textContent = "Rollenstatus wird aktualisiert …";
      const result = await adapter.setMembership({ targetUserId, organizationId, role, status });
      if (!result.ok) {
        button.disabled = false;
        if (feedback) feedback.textContent = `Änderung fehlgeschlagen: ${result.error}`;
        return;
      }

      if (feedback) feedback.textContent = "Rollenstatus aktualisiert.";
      await onChanged();
    });
  });
}
