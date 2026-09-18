export type CreatorTikTokConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "refresh_required"
  | "reconnect_required";

export type CreatorTikTokNextAction =
  | "connect_tiktok"
  | "finish_tiktok_connection"
  | "refresh_tiktok_connection"
  | "reconnect_tiktok"
  | "none";

export type CreatorTikTokConnectionResponse = {
  state: CreatorTikTokConnectionState;
  nextAction: CreatorTikTokNextAction;
  market: string | null;
  externalShopIds: string[];
  grantedScopes: string[];
  lastSyncAt: string | null;
  lastErrorCode: string | null;
};

export interface CreatorTikTokConnectionPort {
  getConnection(): Promise<CreatorTikTokConnectionResponse | null>;
}

type ConnectionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const EXPECTED_ACTION: Record<
  CreatorTikTokConnectionState,
  CreatorTikTokNextAction
> = {
  disconnected: "connect_tiktok",
  connecting: "finish_tiktok_connection",
  connected: "none",
  refresh_required: "refresh_tiktok_connection",
  reconnect_required: "reconnect_tiktok",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function optionalString(
  value: unknown,
  max: number,
  code: string,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error("CREATOR_TIKTOK_CONNECTION_LIST_INVALID");
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error("CREATOR_TIKTOK_CONNECTION_LIST_INVALID");
    }
    const cleaned = item.trim();
    if (!cleaned || cleaned.length > maxLength || seen.has(cleaned)) {
      throw new Error("CREATOR_TIKTOK_CONNECTION_LIST_INVALID");
    }
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("CREATOR_TIKTOK_CONNECTION_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

export function parseCreatorTikTokConnection(
  payload: unknown,
): CreatorTikTokConnectionResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, [
      "state",
      "nextAction",
      "market",
      "externalShopIds",
      "grantedScopes",
      "lastSyncAt",
      "lastErrorCode",
    ])
  ) {
    throw new Error("CREATOR_TIKTOK_CONNECTION_PAYLOAD_INVALID");
  }

  if (
    typeof payload.state !== "string" ||
    !(payload.state in EXPECTED_ACTION) ||
    typeof payload.nextAction !== "string"
  ) {
    throw new Error("CREATOR_TIKTOK_CONNECTION_STATE_INVALID");
  }

  const state = payload.state as CreatorTikTokConnectionState;
  const expectedAction = EXPECTED_ACTION[state];
  if (payload.nextAction !== expectedAction) {
    throw new Error("CREATOR_TIKTOK_CONNECTION_STATE_INCONSISTENT");
  }

  const market = optionalString(
    payload.market,
    16,
    "CREATOR_TIKTOK_CONNECTION_METADATA_INVALID",
  );
  const externalShopIds = stringList(payload.externalShopIds, 100, 256);
  const grantedScopes = stringList(payload.grantedScopes, 100, 256);
  const lastSyncAt = optionalTimestamp(payload.lastSyncAt);
  const lastErrorCode = optionalString(
    payload.lastErrorCode,
    128,
    "CREATOR_TIKTOK_CONNECTION_METADATA_INVALID",
  );

  return {
    state,
    nextAction: expectedAction,
    market,
    externalShopIds,
    grantedScopes,
    lastSyncAt,
    lastErrorCode,
  };
}

export class HttpCreatorTikTokConnectionAdapter
implements CreatorTikTokConnectionPort {
  constructor(
    private readonly endpoint = "/api/creator/tiktok-shop/connection",
    private readonly request: ConnectionFetch = (input, init) =>
      fetch(input, init),
  ) {}

  async getConnection(): Promise<CreatorTikTokConnectionResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorTikTokConnection(await response.json());
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

const PRESENTATION: Record<
  CreatorTikTokConnectionState,
  { title: string; detail: string; badge: string }
> = {
  disconnected: {
    title: "TikTok noch nicht verbunden",
    detail:
      "Für deinen Creator-Account liegt aktuell keine aktive TikTok-Shop-Verbindung vor.",
    badge: "Nicht verbunden",
  },
  connecting: {
    title: "TikTok-Verbindung offen",
    detail:
      "Die Verbindung wurde begonnen, ist aber serverseitig noch nicht vollständig abgeschlossen.",
    badge: "In Verbindung",
  },
  connected: {
    title: "TikTok verbunden",
    detail:
      "Der öffentliche Creator-Verbindungsstatus ist aktiv.",
    badge: "Verbunden",
  },
  refresh_required: {
    title: "TikTok-Verbindung erneuern",
    detail:
      "Die Verbindung benötigt eine serverseitig gesteuerte Aktualisierung.",
    badge: "Refresh erforderlich",
  },
  reconnect_required: {
    title: "TikTok neu verbinden",
    detail:
      "Die bisherige Verbindung kann nicht weiterverwendet werden.",
    badge: "Reconnect erforderlich",
  },
};

const ACTION_LABELS: Record<
  Exclude<CreatorTikTokNextAction, "none">,
  string
> = {
  connect_tiktok: "TikTok verbinden",
  finish_tiktok_connection: "Verbindung abschließen",
  refresh_tiktok_connection: "Verbindung erneuern",
  reconnect_tiktok: "TikTok neu verbinden",
};

function renderAction(action: CreatorTikTokNextAction): string {
  if (action === "none") return "";
  return `<a class="button" href="/creator/onboarding" data-nav>${escapeHtml(ACTION_LABELS[action])}</a>`;
}

function renderList(title: string, values: string[]): string {
  if (!values.length) return "";
  return `<div class="creator-tiktok-connection__list"><strong>${escapeHtml(title)}</strong><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`;
}

export function renderCreatorTikTokConnection(
  response: CreatorTikTokConnectionResponse | null,
): string {
  if (!response) {
    return `<section class="creator-tiktok-connection creator-tiktok-connection--empty"><span class="eyebrow">TIKTOK</span><h2>Verbindungsstatus nicht verfügbar</h2><p>Der TikTok-Status wird erst angezeigt, wenn die serverseitige Creator-Projektion sicher gelesen werden kann.</p></section>`;
  }

  const copy = PRESENTATION[response.state];
  const metadata = [
    response.market ? `Markt: ${escapeHtml(response.market)}` : null,
    response.lastSyncAt
      ? `Letzter Sync: ${escapeHtml(response.lastSyncAt)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const error = response.lastErrorCode
    ? `<p class="creator-tiktok-connection__error">Statuscode: ${escapeHtml(response.lastErrorCode)}</p>`
    : "";

  return `<section class="creator-tiktok-connection creator-tiktok-connection--${response.state}">
    <div class="creator-tiktok-connection__header">
      <div><span class="eyebrow">TIKTOK</span><h2>${copy.title}</h2><p>${copy.detail}</p></div>
      <span class="creator-tiktok-connection__badge">${copy.badge}</span>
    </div>
    ${metadata.length ? `<p class="creator-tiktok-connection__metadata">${metadata.join(" · ")}</p>` : ""}
    ${renderList("Autorisierte Shops", response.externalShopIds)}
    ${renderList("Öffentliche Scope-Namen", response.grantedScopes)}
    ${error}
    ${renderAction(response.nextAction)}
  </section>`;
}
