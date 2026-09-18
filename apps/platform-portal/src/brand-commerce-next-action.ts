export type BrandCommerceNextActionId =
  | "complete_brand_onboarding"
  | "restore_brand_access"
  | "connect_tiktok_shop"
  | "finish_tiktok_shop_connection"
  | "refresh_tiktok_shop_connection"
  | "reconnect_tiktok_shop"
  | "add_first_product"
  | "launch_first_campaign"
  | "review_creator_matches"
  | "resolve_campaign_action"
  | "monitor_active_campaigns";

export type BrandCommerceNextAction = {
  id: BrandCommerceNextActionId;
  priority: "critical" | "high" | "normal";
  reason: string;
};

export type BrandCommerceNextActionResponse = {
  action: BrandCommerceNextAction;
};

export interface BrandCommerceNextActionPort {
  getNextAction(): Promise<BrandCommerceNextActionResponse | null>;
}

type NextActionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const IDS = new Set<BrandCommerceNextActionId>([
  "complete_brand_onboarding",
  "restore_brand_access",
  "connect_tiktok_shop",
  "finish_tiktok_shop_connection",
  "refresh_tiktok_shop_connection",
  "reconnect_tiktok_shop",
  "add_first_product",
  "launch_first_campaign",
  "review_creator_matches",
  "resolve_campaign_action",
  "monitor_active_campaigns",
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

export function parseBrandCommerceNextAction(
  payload: unknown,
): BrandCommerceNextActionResponse {
  if (!isRecord(payload) || !isRecord(payload.action)) {
    throw new Error("BRAND_COMMERCE_NBA_PAYLOAD_INVALID");
  }
  const action = payload.action;
  if (
    typeof action.id !== "string" ||
    !IDS.has(action.id as BrandCommerceNextActionId) ||
    typeof action.priority !== "string" ||
    !PRIORITIES.has(action.priority) ||
    typeof action.reason !== "string" ||
    !action.reason.trim()
  ) {
    throw new Error("BRAND_COMMERCE_NBA_ACTION_INVALID");
  }
  return {
    action: {
      id: action.id as BrandCommerceNextActionId,
      priority: action.priority as BrandCommerceNextAction["priority"],
      reason: action.reason.trim(),
    },
  };
}

export class HttpBrandCommerceNextActionAdapter implements BrandCommerceNextActionPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/next-action",
    private readonly request: NextActionFetch = (input, init) => fetch(input, init),
  ) {}

  async getNextAction(): Promise<BrandCommerceNextActionResponse | null> {
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
      return parseBrandCommerceNextAction(await response.json());
    } catch {
      return null;
    }
  }
}

const PRESENTATION: Record<BrandCommerceNextActionId, { label: string; href: string }> = {
  complete_brand_onboarding: { label: "Onboarding abschließen", href: "/brand/setup" },
  restore_brand_access: { label: "Zugriff klären", href: "/brand/setup" },
  connect_tiktok_shop: { label: "TikTok Shop verbinden", href: "/brand/setup" },
  finish_tiktok_shop_connection: { label: "Verbindung abschließen", href: "/brand/setup" },
  refresh_tiktok_shop_connection: { label: "Verbindung erneuern", href: "/brand/setup" },
  reconnect_tiktok_shop: { label: "TikTok Shop neu verbinden", href: "/brand/setup" },
  add_first_product: { label: "Produkt hinzufügen", href: "/brand/products" },
  launch_first_campaign: { label: "Campaign aufsetzen", href: "/brand/campaigns" },
  review_creator_matches: { label: "Creator prüfen", href: "/brand/creators" },
  resolve_campaign_action: { label: "Campaign-Aktion öffnen", href: "/brand/campaigns" },
  monitor_active_campaigns: { label: "Campaigns ansehen", href: "/brand/campaigns" },
};

export function renderBrandCommerceNextAction(
  response: BrandCommerceNextActionResponse | null,
): string {
  if (!response) {
    return `<section class="brand-commerce-nba brand-commerce-nba--empty"><span class="eyebrow">NEXT BEST ACTION</span><h2>Noch keine priorisierte Aktion</h2><p>Die nächste Aktion wird erst angezeigt, wenn der serverseitige Brand-Status belastbar vorliegt.</p></section>`;
  }

  const { action } = response;
  const presentation = PRESENTATION[action.id];
  return `<section class="brand-commerce-nba brand-commerce-nba--${action.priority}">
    <div><span class="eyebrow">NEXT BEST ACTION</span><span class="brand-commerce-nba__priority">${escapeHtml(action.priority.toUpperCase())}</span></div>
    <h2>${escapeHtml(presentation.label)}</h2>
    <p>${escapeHtml(action.reason)}</p>
    <a class="button" href="${escapeHtml(presentation.href)}" data-nav>${escapeHtml(presentation.label)}</a>
  </section>`;
}
