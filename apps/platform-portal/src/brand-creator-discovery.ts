export type BrandCreatorDiscoveryRow = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  market: string | null;
  language: string | null;
  niches: string[];
  verification: "verified" | "not_verified";
  performance: {
    gmVCents: number | null;
    orders: number | null;
    postedContent: number | null;
    updatedAt: string | null;
  };
  matchScore: number;
  matchReasons: string[];
};

export type BrandCreatorDiscoveryResponse = {
  totalMatches: number;
  creators: BrandCreatorDiscoveryRow[];
};

export interface BrandCreatorDiscoveryPort {
  getCreators(): Promise<BrandCreatorDiscoveryResponse | null>;
}

type DiscoveryFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function requiredString(value: unknown, max: number, code: string): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function optionalString(value: unknown, max: number, code: string): string | null {
  if (value === null) return null;
  return requiredString(value, max, code);
}

function nonNegativeSafeIntegerOrNull(value: unknown, code: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code);
  return value as number;
}

function parseStringList(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
  code: string,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(code);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const cleaned = requiredString(item, maxItemLength, code);
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(code);
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function parseTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("BRAND_DISCOVERY_PERFORMANCE_INVALID");
  }
  return value;
}

export function parseBrandCreatorDiscovery(
  payload: unknown,
): BrandCreatorDiscoveryResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["totalMatches", "creators"]) ||
    !Number.isSafeInteger(payload.totalMatches) ||
    (payload.totalMatches as number) < 0 ||
    !Array.isArray(payload.creators)
  ) {
    throw new Error("BRAND_DISCOVERY_PAYLOAD_INVALID");
  }

  if (payload.totalMatches !== payload.creators.length) {
    throw new Error("BRAND_DISCOVERY_TOTAL_MISMATCH");
  }

  const seenIds = new Set<string>();
  const creators = payload.creators.map((raw): BrandCreatorDiscoveryRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "creatorProfileId",
        "displayName",
        "tiktokHandle",
        "market",
        "language",
        "niches",
        "verification",
        "performance",
        "matchScore",
        "matchReasons",
      ]) ||
      !isRecord(raw.performance) ||
      !hasOnlyKeys(raw.performance, [
        "gmVCents",
        "orders",
        "postedContent",
        "updatedAt",
      ])
    ) {
      throw new Error("BRAND_DISCOVERY_ROW_INVALID");
    }

    const creatorProfileId = requiredString(
      raw.creatorProfileId,
      128,
      "BRAND_DISCOVERY_ROW_INVALID",
    );
    if (seenIds.has(creatorProfileId)) throw new Error("BRAND_DISCOVERY_DUPLICATE_CREATOR");
    seenIds.add(creatorProfileId);

    const displayName = requiredString(raw.displayName, 256, "BRAND_DISCOVERY_ROW_INVALID");
    const tiktokHandle = requiredString(raw.tiktokHandle, 128, "BRAND_DISCOVERY_ROW_INVALID");
    const market = optionalString(raw.market, 16, "BRAND_DISCOVERY_ROW_INVALID");
    const language = optionalString(raw.language, 16, "BRAND_DISCOVERY_ROW_INVALID");
    const niches = parseStringList(raw.niches, 20, 80, "BRAND_DISCOVERY_ROW_INVALID");

    if (raw.verification !== "verified" && raw.verification !== "not_verified") {
      throw new Error("BRAND_DISCOVERY_ROW_INVALID");
    }
    if (
      !Number.isInteger(raw.matchScore) ||
      (raw.matchScore as number) < 0 ||
      (raw.matchScore as number) > 100
    ) {
      throw new Error("BRAND_DISCOVERY_ROW_INVALID");
    }

    const matchReasons = parseStringList(
      raw.matchReasons,
      20,
      200,
      "BRAND_DISCOVERY_ROW_INVALID",
    );

    return {
      creatorProfileId,
      displayName,
      tiktokHandle,
      market,
      language,
      niches,
      verification: raw.verification,
      performance: {
        gmVCents: nonNegativeSafeIntegerOrNull(
          raw.performance.gmVCents,
          "BRAND_DISCOVERY_PERFORMANCE_INVALID",
        ),
        orders: nonNegativeSafeIntegerOrNull(
          raw.performance.orders,
          "BRAND_DISCOVERY_PERFORMANCE_INVALID",
        ),
        postedContent: nonNegativeSafeIntegerOrNull(
          raw.performance.postedContent,
          "BRAND_DISCOVERY_PERFORMANCE_INVALID",
        ),
        updatedAt: parseTimestamp(raw.performance.updatedAt),
      },
      matchScore: raw.matchScore as number,
      matchReasons,
    };
  });

  return { totalMatches: payload.totalMatches as number, creators };
}

export class HttpBrandCreatorDiscoveryAdapter implements BrandCreatorDiscoveryPort {
  constructor(
    private readonly organizationId: string,
    private readonly endpoint = "/api/brand/creators/discovery",
    private readonly request: DiscoveryFetch = (input, init) => fetch(input, init),
  ) {}

  async getCreators(): Promise<BrandCreatorDiscoveryResponse | null> {
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
      return parseBrandCreatorDiscovery(await response.json());
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

function renderList(values: string[], className: string): string {
  if (!values.length) return "";
  return `<ul class="${className}">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

export function renderBrandCreatorDiscovery(
  response: BrandCreatorDiscoveryResponse | null,
): string {
  if (!response) {
    return `<section class="brand-discovery brand-discovery--empty"><span class="eyebrow">CREATOR DISCOVERY</span><h2>Creator nicht verfügbar</h2><p>Es werden keine Creator angezeigt, solange die serverseitig freigegebene Discovery-Projektion nicht belastbar vorliegt.</p></section>`;
  }

  if (response.creators.length === 0) {
    return `<section class="brand-discovery brand-discovery--empty"><span class="eyebrow">CREATOR DISCOVERY</span><h2>Keine freigegebenen Treffer</h2><p>Die aktuelle Discovery-Abfrage enthält keine für Brands freigegebenen Creator.</p></section>`;
  }

  const cards = response.creators.map((creator) => {
    const verification = creator.verification === "verified" ? "Verifiziert" : "Nicht verifiziert";
    const location = [creator.market, creator.language].filter(Boolean).join(" · ") || "Keine Markt-/Sprachangabe";
    const performanceParts = [
      creator.performance.orders === null ? null : `${creator.performance.orders} Orders`,
      creator.performance.postedContent === null ? null : `${creator.performance.postedContent} Contents`,
      creator.performance.updatedAt === null ? null : `Stand ${escapeHtml(creator.performance.updatedAt)}`,
    ].filter((value): value is string => Boolean(value));
    const performance = performanceParts.length
      ? performanceParts.join(" · ")
      : "Keine öffentlichen Performancewerte";

    return `<article class="brand-discovery__card">
      <div class="brand-discovery__card-header">
        <div><h3>${escapeHtml(creator.displayName)}</h3><p>@${escapeHtml(creator.tiktokHandle)}</p></div>
        <span class="brand-discovery__score">${creator.matchScore}/100</span>
      </div>
      <p>${escapeHtml(location)} · ${verification}</p>
      ${renderList(creator.niches, "brand-discovery__niches")}
      <p class="brand-discovery__performance">${performance}</p>
      ${renderList(creator.matchReasons, "brand-discovery__reasons")}
    </article>`;
  }).join("");

  return `<section class="brand-discovery">
    <div class="brand-discovery__header"><div><span class="eyebrow">CREATOR DISCOVERY</span><h2>Freigegebene Creator</h2></div><span>${response.totalMatches} Treffer</span></div>
    <div class="brand-discovery__list">${cards}</div>
  </section>`;
}
