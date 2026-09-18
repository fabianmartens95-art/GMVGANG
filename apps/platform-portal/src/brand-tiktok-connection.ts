export type BrandTikTokConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "refresh_required"
  | "reconnect_required";

export type BrandTikTokNextAction =
  | "connect_tiktok_shop"
  | "finish_tiktok_shop_connection"
  | "refresh_tiktok_shop_connection"
  | "reconnect_tiktok_shop"
  | "none";

export type BrandTikTokConnectionResponse = {
  state: BrandTikTokConnectionState;
  nextAction: BrandTikTokNextAction;
  market: string | null;
  externalAccountId: string | null;
  externalShopIds: string[];
  grantedScopes: string[];
  lastSyncAt: string | null;
  lastErrorCode: string | null;
};

export interface BrandTikTokConnectionPort {
  getConnection(): Promise<BrandTikTokConnectionResponse | null>;
}

type ConnectionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const EXPECTED_ACTION: Record<BrandTikTokConnectionState, BrandTikTokNextAction> = {
  disconnected: "connect_tiktok_shop",
  connecting: "finish_tiktok_shop_connection",
  connected: "none",
  refresh_required: "refresh_tiktok_shop_connection",
  reconnect_required: "reconnect_tiktok_shop",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function optionalString(value: unknown, max: number, code: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error("BRAND_TIKTOK_CONNECTION_LIST_INVALID");
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") throw new Error("BRAND_TIKTOK_CONNECTION_LIST_INVALID");
    const cleaned = item.trim();
    if (!cleaned || cleaned.length > maxLength || seen.has(cleaned)) {
      throw new Error("BRAND_TIKTOK_CONNECTION_LIST_INVALID");
    }
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_TIKTOK_CONNECTION_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

export function parseBrandTikTokConnection(
  payload: unknown,
): BrandTikTokConnectionResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, [
      "state",
      "nextAction",
      "market",
      "externalAccountId",
      "externalShopIds",
      "grantedScopes",
      "lastSyncAt",
      "lastErrorCode",
    ])
  ) {
    throw new Error("BRAND_TIKTOK_CONNECTION_PAYLOAD_INVALID");
  }

  if (
    typeof payload.state !== "string" ||
    !(payload.state in EXPECTED_ACTION) ||
    typeof payload.nextAction !== "string"
  ) {
    throw new Error("BRAND_TIKTOK_CONNECTION_STATE_INVALID");
  }

  const state = payload.state as BrandTikTokConnectionState;
  const expected = EXPECTED_ACTION[state];
  if (payload.nextAction !== expected) {
    throw new Error("BRAND_TIKTOK_CONNECTION_STATE_INCONSISTENT");
  }

  return {
    state,
    nextAction: expected,
    market: optionalString(payload.market, 16, "BRAND_TIKTOK_CONNECTION_METADATA_INVALID"),
    externalAccountId: optionalString(
      payload.externalAccountId,
      256,
      "BRAND_TIKTOK_CONNECTION_METADATA_INVALID",
    ),
    externalShopIds: stringList(payload.externalShopIds, 100, 256),
    grantedScopes: stringList(payload.grantedScopes, 100, 256),
    lastSyncAt: optionalTimestamp(payload.lastSyncAt),
    lastErrorCode: optionalString(
      payload.lastErrorCode,
      128,
      "BRAND_TIKTOK_CONNECTION_METADATA_INVALID",
    ),
  };
}

export class HttpBrandTikTokConnectionAdapter implements BrandTikTokConnectionPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/tiktok-shop/connection",
    private readonly request: ConnectionFetch = (input, init) => fetch(input, init),
  ) {}

  async getConnection(): Promise<BrandTikTokConnectionResponse | null> {
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
      return parseBrandTikTokConnection(await response.json());
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

const PRESENTATION: Record<BrandTikTokConnectionState, {
  title: string;
  detail: string;
  badge: string;
}> = {
  disconnected: {
    title: "TikTok Shop nicht verbunden",
    detail: "Für diesen Brand-Workspace liegt keine aktive Seller-Verbindung vor.",
    badge: "Nicht verbunden",
  },
  connecting: {
    title: "TikTok Shop Verbindung offen",
    detail: "Die Seller-Verbindung wurde begonnen, ist aber noch nicht abgeschlossen.",
    badge: "In Verbindung",
  },
  connected: {
    title: "TikTok Shop verbunden",
    detail: "Der öffentliche Seller-Verbindungsstatus ist aktiv.",
    badge: "Verbunden",
  },
  refresh_required: {
    title: "TikTok Shop Verbindung erneuern",
    detail: "Die Verbindung benötigt eine serverseitig gesteuerte Aktualisierung.",
    badge: "Refresh erforderlich",
  },
  reconnect_required: {
    title: "TikTok Shop neu verbinden",
    detail: "Die bestehende Seller-Verbindung kann nicht weiterverwendet werden.",
    badge: "Reconnect erforderlich",
  },
};

const ACTION_LABELS: Record<Exclude<BrandTikTokNextAction, "none">, string> = {
  connect_tiktok_shop: "TikTok Shop verbinden",
  finish_tiktok_shop_connection: "Verbindung abschließen",
  refresh_tiktok_shop_connection: "Verbindung erneuern",
  reconnect_tiktok_shop: "TikTok Shop neu verbinden",
};

function renderAction(action: BrandTikTokNextAction): string {
  if (action === "none") return "";
  return `<a class="button" href="/brand/setup" data-nav>${escapeHtml(ACTION_LABELS[action])}</a>`;
}

function renderList(title: string, values: string[]): string {
  if (!values.length) return "";
  return `<div class="brand-tiktok-connection__list"><strong>${escapeHtml(title)}</strong><ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`;
}

export function renderBrandTikTokConnection(
  response: BrandTikTokConnectionResponse | null,
): string {
  if (!response) {
    return `<section class="brand-tiktok-connection brand-tiktok-connection--empty"><span class="eyebrow">TIKTOK SHOP</span><h2>Verbindungsstatus nicht verfügbar</h2><p>Der Seller-Status wird erst angezeigt, wenn die serverseitige Connection-Projektion sicher gelesen werden kann.</p></section>`;
  }

  const copy = PRESENTATION[response.state];
  const metadata = [
    response.market ? `Markt: ${escapeHtml(response.market)}` : null,
    response.externalAccountId ? `Seller: ${escapeHtml(response.externalAccountId)}` : null,
    response.lastSyncAt ? `Letzter Sync: ${escapeHtml(response.lastSyncAt)}` : null,
  ].filter((value): value is string => Boolean(value));

  const error = response.lastErrorCode
    ? `<p class="brand-tiktok-connection__error">Statuscode: ${escapeHtml(response.lastErrorCode)}</p>`
    : "";

  return `<section class="brand-tiktok-connection brand-tiktok-connection--${response.state}">
    <div class="brand-tiktok-connection__header">
      <div><span class="eyebrow">TIKTOK SHOP</span><h2>${copy.title}</h2><p>${copy.detail}</p></div>
      <span class="brand-tiktok-connection__badge">${copy.badge}</span>
    </div>
    ${metadata.length ? `<p class="brand-tiktok-connection__metadata">${metadata.join(" · ")}</p>` : ""}
    ${renderList("Autorisierte Shops", response.externalShopIds)}
    ${renderList("Öffentliche Scope-Namen", response.grantedScopes)}
    ${error}
    ${renderAction(response.nextAction)}
  </section>`;
}
