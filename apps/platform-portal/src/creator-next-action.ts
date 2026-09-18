export type CreatorNextActionId =
  | "complete_profile"
  | "complete_qualification"
  | "connect_tiktok"
  | "finish_tiktok_connection"
  | "refresh_tiktok_connection"
  | "reconnect_tiktok"
  | "review_campaign_opportunity"
  | "submit_campaign_content"
  | "review_sample_status"
  | "explore_matches";

export type CreatorNextAction = {
  id: CreatorNextActionId;
  priority: "critical" | "high" | "normal";
  reason: string;
};

export type CreatorNextActionResponse = { action: CreatorNextAction };

export interface CreatorNextActionPort {
  getNextAction(): Promise<CreatorNextActionResponse | null>;
}

type NextActionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const IDS = new Set<CreatorNextActionId>([
  "complete_profile",
  "complete_qualification",
  "connect_tiktok",
  "finish_tiktok_connection",
  "refresh_tiktok_connection",
  "reconnect_tiktok",
  "review_campaign_opportunity",
  "submit_campaign_content",
  "review_sample_status",
  "explore_matches",
]);
const PRIORITIES = new Set(["critical", "high", "normal"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parseCreatorNextAction(payload: unknown): CreatorNextActionResponse {
  if (!isRecord(payload) || !isRecord(payload.action)) {
    throw new Error("CREATOR_NBA_PAYLOAD_INVALID");
  }

  const action = payload.action;
  if (
    typeof action.id !== "string" ||
    !IDS.has(action.id as CreatorNextActionId) ||
    typeof action.priority !== "string" ||
    !PRIORITIES.has(action.priority) ||
    typeof action.reason !== "string" ||
    !action.reason.trim()
  ) {
    throw new Error("CREATOR_NBA_ACTION_INVALID");
  }

  return {
    action: {
      id: action.id as CreatorNextActionId,
      priority: action.priority as CreatorNextAction["priority"],
      reason: action.reason.trim(),
    },
  };
}

export class HttpCreatorNextActionAdapter implements CreatorNextActionPort {
  constructor(
    private readonly endpoint = "/api/creator/next-action",
    private readonly request: NextActionFetch = (input, init) => fetch(input, init),
  ) {}

  async getNextAction(): Promise<CreatorNextActionResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorNextAction(await response.json());
    } catch {
      return null;
    }
  }
}

const PRESENTATION: Record<CreatorNextActionId, { label: string; href: string }> = {
  complete_profile: { label: "Profil vervollständigen", href: "/creator/profile" },
  complete_qualification: { label: "Qualifizierung abschließen", href: "/creator/qualification" },
  connect_tiktok: { label: "TikTok verbinden", href: "/creator/onboarding" },
  finish_tiktok_connection: { label: "TikTok-Verbindung abschließen", href: "/creator/onboarding" },
  refresh_tiktok_connection: { label: "TikTok-Verbindung erneuern", href: "/creator/onboarding" },
  reconnect_tiktok: { label: "TikTok neu verbinden", href: "/creator/onboarding" },
  review_campaign_opportunity: { label: "Campaign prüfen", href: "/creator/campaigns" },
  submit_campaign_content: { label: "Content einreichen", href: "/creator/campaigns" },
  review_sample_status: { label: "Sample-Status prüfen", href: "/creator/campaigns" },
  explore_matches: { label: "Matches ansehen", href: "/creator/matches" },
};

export function renderCreatorNextAction(
  response: CreatorNextActionResponse | null,
): string {
  if (!response) {
    return `<section class="creator-nba creator-nba--empty"><span class="eyebrow">NEXT BEST ACTION</span><h2>Noch keine priorisierte Aktion</h2><p>Die nächste Aktion erscheint erst, wenn dein serverseitiger Creator-Status vollständig gelesen werden kann.</p></section>`;
  }

  const { action } = response;
  const presentation = PRESENTATION[action.id];
  return `<section class="creator-nba creator-nba--${action.priority}">
    <div class="creator-nba__top"><span class="eyebrow">NEXT BEST ACTION</span><span class="creator-nba__priority">${escapeHtml(action.priority.toUpperCase())}</span></div>
    <h2>${escapeHtml(presentation.label)}</h2>
    <p>${escapeHtml(action.reason)}</p>
    <a class="button" href="${escapeHtml(presentation.href)}" data-nav>${escapeHtml(presentation.label)}</a>
  </section>`;
}
