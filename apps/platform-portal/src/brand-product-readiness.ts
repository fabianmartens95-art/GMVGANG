export type BrandProductSurfaceStatus = "draft" | "active" | "archived";

export type BrandProductReadinessBlocker =
  | "name_required"
  | "name_too_long"
  | "sku_required"
  | "sku_too_long"
  | "sale_price_required"
  | "invalid_economics"
  | "invalid_tiktok_shop_url"
  | "invalid_image_url";

export type BrandProductReadinessWarning =
  | "inventory_zero"
  | "cogs_zero"
  | "affiliate_commission_zero"
  | "tiktok_shop_url_missing";

export type BrandProductReadinessRow = {
  id: string;
  name: string;
  sku: string;
  status: BrandProductSurfaceStatus;
  readiness: {
    canActivate: boolean;
    blockers: BrandProductReadinessBlocker[];
    warnings: BrandProductReadinessWarning[];
  };
};

export type BrandProductReadinessResponse = {
  products: BrandProductReadinessRow[];
};

export interface BrandProductReadinessPort {
  getReadiness(): Promise<BrandProductReadinessResponse | null>;
}

type ProductReadinessFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const STATUSES = new Set<BrandProductSurfaceStatus>(["draft", "active", "archived"]);
const BLOCKERS = new Set<BrandProductReadinessBlocker>([
  "name_required",
  "name_too_long",
  "sku_required",
  "sku_too_long",
  "sale_price_required",
  "invalid_economics",
  "invalid_tiktok_shop_url",
  "invalid_image_url",
]);
const WARNINGS = new Set<BrandProductReadinessWarning>([
  "inventory_zero",
  "cogs_zero",
  "affiliate_commission_zero",
  "tiktok_shop_url_missing",
]);

const BLOCKER_LABELS: Record<BrandProductReadinessBlocker, string> = {
  name_required: "Produktname fehlt",
  name_too_long: "Produktname ist zu lang",
  sku_required: "SKU fehlt",
  sku_too_long: "SKU ist zu lang",
  sale_price_required: "Verkaufspreis fehlt",
  invalid_economics: "Commerce-Daten sind ungültig",
  invalid_tiktok_shop_url: "TikTok-Shop-URL ist ungültig",
  invalid_image_url: "Bild-URL ist ungültig",
};

const WARNING_LABELS: Record<BrandProductReadinessWarning, string> = {
  inventory_zero: "Bestand ist 0",
  cogs_zero: "COGS sind 0",
  affiliate_commission_zero: "Affiliate-Provision ist 0",
  tiktok_shop_url_missing: "TikTok-Shop-URL fehlt",
};

const STATUS_LABELS: Record<BrandProductSurfaceStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

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

function stringField(value: unknown, maxLength: number, error: string): string {
  if (typeof value !== "string" || value.length > maxLength) throw new Error(error);
  return value.trim();
}

function parseKnownArray<T extends string>(
  value: unknown,
  allowed: Set<T>,
  error: string,
): T[] {
  if (!Array.isArray(value)) throw new Error(error);
  const parsed: T[] = [];
  const seen = new Set<T>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item as T)) throw new Error(error);
    const known = item as T;
    if (seen.has(known)) throw new Error(error);
    seen.add(known);
    parsed.push(known);
  }
  return parsed;
}

export function parseBrandProductReadiness(
  payload: unknown,
): BrandProductReadinessResponse {
  if (!isRecord(payload) || !Array.isArray(payload.products)) {
    throw new Error("BRAND_PRODUCT_READINESS_PAYLOAD_INVALID");
  }

  const seenIds = new Set<string>();
  const products = payload.products.map((raw): BrandProductReadinessRow => {
    if (!isRecord(raw) || !isRecord(raw.readiness)) {
      throw new Error("BRAND_PRODUCT_READINESS_ROW_INVALID");
    }

    const id = stringField(raw.id, 128, "BRAND_PRODUCT_READINESS_ROW_INVALID");
    if (!id || seenIds.has(id)) throw new Error("BRAND_PRODUCT_READINESS_ROW_INVALID");
    seenIds.add(id);

    const name = stringField(raw.name, 200, "BRAND_PRODUCT_READINESS_ROW_INVALID");
    const sku = stringField(raw.sku, 128, "BRAND_PRODUCT_READINESS_ROW_INVALID");

    if (typeof raw.status !== "string" || !STATUSES.has(raw.status as BrandProductSurfaceStatus)) {
      throw new Error("BRAND_PRODUCT_READINESS_ROW_INVALID");
    }

    const canActivate = raw.readiness.canActivate;
    if (typeof canActivate !== "boolean") {
      throw new Error("BRAND_PRODUCT_READINESS_ROW_INVALID");
    }

    const blockers = parseKnownArray(
      raw.readiness.blockers,
      BLOCKERS,
      "BRAND_PRODUCT_READINESS_ROW_INVALID",
    );
    const warnings = parseKnownArray(
      raw.readiness.warnings,
      WARNINGS,
      "BRAND_PRODUCT_READINESS_ROW_INVALID",
    );

    if (canActivate !== (blockers.length === 0)) {
      throw new Error("BRAND_PRODUCT_READINESS_INCONSISTENT");
    }

    return {
      id,
      name,
      sku,
      status: raw.status as BrandProductSurfaceStatus,
      readiness: { canActivate, blockers, warnings },
    };
  });

  return { products };
}

export class HttpBrandProductReadinessAdapter implements BrandProductReadinessPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/products/readiness",
    private readonly request: ProductReadinessFetch = (input, init) => fetch(input, init),
  ) {}

  async getReadiness(): Promise<BrandProductReadinessResponse | null> {
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
      return parseBrandProductReadiness(await response.json());
    } catch {
      return null;
    }
  }
}

function renderIssues<T extends string>(
  title: string,
  values: T[],
  labels: Record<T, string>,
  kind: "blocker" | "warning",
): string {
  if (!values.length) return "";
  const items = values
    .map((value) => `<li>${escapeHtml(labels[value])}</li>`)
    .join("");
  return `<div class="brand-product-readiness__issues brand-product-readiness__issues--${kind}"><strong>${escapeHtml(title)}</strong><ul>${items}</ul></div>`;
}

export function renderBrandProductReadiness(
  response: BrandProductReadinessResponse | null,
): string {
  if (!response) {
    return `<section class="brand-product-readiness brand-product-readiness--empty"><span class="eyebrow">PRODUCT READINESS</span><h2>Readiness nicht verfügbar</h2><p>Produktstatus und Readiness werden erst angezeigt, wenn der serverseitige Brand-Kontext belastbar gelesen werden kann.</p></section>`;
  }

  if (response.products.length === 0) {
    return `<section class="brand-product-readiness brand-product-readiness--empty"><span class="eyebrow">PRODUCT READINESS</span><h2>Noch keine Produkte</h2><p>Lege zuerst ein Produkt an. Die Aktivierungs-Readiness wird anschließend serverseitig bewertet.</p><a class="button" href="/brand/products" data-nav>Produkte öffnen</a></section>`;
  }

  const readyCount = response.products.filter((product) => product.readiness.canActivate).length;
  const blockedCount = response.products.length - readyCount;
  const warningCount = response.products.filter((product) => product.readiness.warnings.length > 0).length;

  const cards = response.products.map((product) => {
    const displayName = product.name || "Unbenanntes Produkt";
    const displaySku = product.sku || "SKU fehlt";
    const readinessLabel = product.readiness.canActivate ? "Aktivierbar" : "Blockiert";
    const blockers = renderIssues(
      "Aktivierungsblocker",
      product.readiness.blockers,
      BLOCKER_LABELS,
      "blocker",
    );
    const warnings = renderIssues(
      "Hinweise",
      product.readiness.warnings,
      WARNING_LABELS,
      "warning",
    );

    return `<article class="brand-product-readiness__card">
      <div class="brand-product-readiness__card-header">
        <div><span class="eyebrow">${escapeHtml(STATUS_LABELS[product.status])}</span><h3>${escapeHtml(displayName)}</h3><p>${escapeHtml(displaySku)}</p></div>
        <span class="brand-product-readiness__state brand-product-readiness__state--${product.readiness.canActivate ? "ready" : "blocked"}">${escapeHtml(readinessLabel)}</span>
      </div>
      ${blockers}
      ${warnings}
    </article>`;
  }).join("");

  return `<section class="brand-product-readiness">
    <div class="brand-product-readiness__header"><div><span class="eyebrow">PRODUCT READINESS</span><h2>Aktivierungsbereitschaft</h2><p>Die Anzeige spiegelt ausschließlich serverseitig berechnete Readiness wider und führt keine Produktmutation aus.</p></div><a class="button" href="/brand/products" data-nav>Produkte öffnen</a></div>
    <div class="brand-product-readiness__summary">
      <article><span>Produkte</span><strong>${response.products.length}</strong></article>
      <article><span>Aktivierbar</span><strong>${readyCount}</strong></article>
      <article><span>Blockiert</span><strong>${blockedCount}</strong></article>
      <article><span>Mit Hinweisen</span><strong>${warningCount}</strong></article>
    </div>
    <div class="brand-product-readiness__list">${cards}</div>
  </section>`;
}
