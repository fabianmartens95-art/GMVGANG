type FunnelStep = "registered" | "profile" | "qualification" | "complete";
type FunnelHealth = "in_progress" | "stalled" | "complete";

type ActivityItem = {
  source: "analytics" | "audit";
  event: string;
  occurredAt: string;
  path?: string;
};

type CreatorItem = {
  userId: string;
  email: string | null;
  creatorProfileId: string | null;
  displayName: string | null;
  tiktokHandle: string | null;
  networkStatus: string | null;
  profileCompletionPercent: number;
  registeredAt: string;
  lastActivityAt: string;
  qualificationSubmittedAt: string | null;
  currentStep: FunnelStep;
  health: FunnelHealth;
  stalledForMinutes: number | null;
  activity: ActivityItem[];
};

export type TeamCreatorFunnelModel = {
  generatedAt: string;
  stalledAfterMinutes: number;
  summary: {
    totalCreators: number;
    completed: number;
    stalled: number;
    inProgress: number;
    registrationsLast24h: number;
  };
  creators: CreatorItem[];
};

export type TeamCreatorFunnelResult =
  | { ok: true; model: TeamCreatorFunnelModel }
  | { ok: false; status: number; error: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function creatorLabel(creator: CreatorItem): string {
  return creator.displayName || creator.tiktokHandle || creator.email || "Creator";
}

function stepLabel(step: FunnelStep): string {
  return {
    registered: "Registriert",
    profile: "Profil offen",
    qualification: "Qualifizierung offen",
    complete: "Qualifiziert",
  }[step];
}

function healthLabel(health: FunnelHealth): string {
  return {
    in_progress: "Aktiv",
    stalled: "Abbruch-Risiko",
    complete: "Komplett",
  }[health];
}

function healthClass(health: FunnelHealth): string {
  return health === "stalled" ? "is-stalled" : health === "complete" ? "is-complete" : "is-active";
}

export class HttpTeamCreatorFunnelAdapter {
  async getFunnel(): Promise<TeamCreatorFunnelResult> {
    try {
      const response = await fetch("/api/team/creator-funnel", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({})) as {
        model?: TeamCreatorFunnelModel;
        error?: string;
      };
      if (!response.ok || !payload.model) {
        return { ok: false, status: response.status, error: payload.error ?? "creator_operations_unavailable" };
      }
      return { ok: true, model: payload.model };
    } catch {
      return { ok: false, status: 0, error: "network_error" };
    }
  }
}

function unavailable(result: Extract<TeamCreatorFunnelResult, { ok: false }>): string {
  const denied = result.status === 403;
  return `
    <section class="team-funnel-empty">
      <span class="team-funnel-kicker">${denied ? "ACCESS DENIED" : "DATA UNAVAILABLE"}</span>
      <h2>${denied ? "Creator Operations ist für deine Rolle nicht freigegeben." : "Creator Funnel konnte nicht geladen werden."}</h2>
      <p>${denied ? "Für diese Ansicht ist die Capability creators.read_all erforderlich." : "Die Ansicht bleibt geschlossen, bis der serverseitige Read-Model wieder verfügbar ist."}</p>
    </section>`;
}

export function renderTeamCreatorOperations(result: TeamCreatorFunnelResult): string {
  if (!result.ok) return unavailable(result);
  const { model } = result;

  return `
    <section class="team-funnel">
      <div class="team-funnel-summary">
        <article><span>Creator</span><strong>${model.summary.totalCreators}</strong></article>
        <article><span>Neu 24h</span><strong>${model.summary.registrationsLast24h}</strong></article>
        <article><span>Aktiv</span><strong>${model.summary.inProgress}</strong></article>
        <article class="${model.summary.stalled ? "has-alert" : ""}"><span>Abbruch-Risiko</span><strong>${model.summary.stalled}</strong></article>
        <article><span>Qualifiziert</span><strong>${model.summary.completed}</strong></article>
      </div>

      <div class="team-funnel-head">
        <div>
          <span class="team-funnel-kicker">CREATOR FUNNEL</span>
          <h2>Registrierungen & Fortschritt</h2>
        </div>
        <span class="team-funnel-rule">Stalled nach ${model.stalledAfterMinutes} Min. ohne Fortschritt</span>
      </div>

      <div class="team-funnel-table-wrap">
        <table class="team-funnel-table">
          <thead><tr><th>Creator</th><th>Schritt</th><th>Status</th><th>Profil</th><th>Letzte Aktivität</th><th>Registriert</th></tr></thead>
          <tbody>
            ${model.creators.length ? model.creators.map((creator) => `
              <tr>
                <td>
                  <strong>${escapeHtml(creatorLabel(creator))}</strong>
                  <small>${creator.tiktokHandle ? `@${escapeHtml(creator.tiktokHandle.replace(/^@/, ""))}` : escapeHtml(creator.email ?? "")}</small>
                </td>
                <td>${escapeHtml(stepLabel(creator.currentStep))}</td>
                <td><span class="team-funnel-health ${healthClass(creator.health)}">${escapeHtml(healthLabel(creator.health))}</span>${creator.stalledForMinutes ? `<small>${creator.stalledForMinutes} Min.</small>` : ""}</td>
                <td>${creator.profileCompletionPercent}%</td>
                <td>${formatDate(creator.lastActivityAt)}</td>
                <td>${formatDate(creator.registeredAt)}</td>
              </tr>`).join("") : '<tr><td colspan="6" class="team-funnel-empty-row">Noch keine externen Creator im Funnel.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`;
}

export function renderTeamActivityTrail(result: TeamCreatorFunnelResult): string {
  if (!result.ok) return unavailable(result);
  const activity = result.model.creators.flatMap((creator) =>
    creator.activity.map((event) => ({ creator, event })),
  ).sort((a, b) => Date.parse(b.event.occurredAt) - Date.parse(a.event.occurredAt)).slice(0, 60);

  return `
    <section class="team-activity">
      <div class="team-funnel-head">
        <div>
          <span class="team-funnel-kicker">ACTIVITY TRAIL</span>
          <h2>Letzte Creator-Aktivitäten</h2>
        </div>
        <span class="team-funnel-rule">Audit + Portal Analytics</span>
      </div>
      <div class="team-activity-list">
        ${activity.length ? activity.map(({ creator, event }) => `
          <article class="team-activity-item">
            <time>${formatDate(event.occurredAt)}</time>
            <div>
              <strong>${escapeHtml(creatorLabel(creator))}</strong>
              <span>${escapeHtml(event.event)}</span>
              ${event.path ? `<small>${escapeHtml(event.path)}</small>` : ""}
            </div>
            <em>${event.source}</em>
          </article>`).join("") : '<p class="team-funnel-empty-row">Noch keine neuen Activity-Events seit Aktivierung des Trackings.</p>'}
      </div>
    </section>`;
}
