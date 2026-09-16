import type { CreatorOperationsSyncPort } from "@gmvgang/platform-api";

type CreatorProfile = Parameters<CreatorOperationsSyncPort["syncCreatorProfile"]>[0];

const NOTION_API_VERSION = "2026-03-11";
const NOTION_API_ORIGIN = "https://api.notion.com";

type NotionCreatorSyncConfig = {
  token: string;
  dataSourceId: string;
};

type NotionHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type NotionFetch = (
  input: string,
  init: {
    method: "POST" | "PATCH";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<NotionHttpResponse>;

function cleanDataSourceId(value: string): string {
  const cleaned = value.trim().replace(/^collection:\/\//, "");
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(cleaned)) throw new Error("NOTION_CREATOR_DATA_SOURCE_ID_INVALID");
  return cleaned;
}

function richText(content: string) {
  return { rich_text: [{ type: "text", text: { content } }] };
}

function title(content: string) {
  return { title: [{ type: "text", text: { content } }] };
}

function select(name: string) {
  return { select: { name } };
}

function checkbox(value: boolean) {
  return { checkbox: value };
}

function multiSelect(names: readonly string[]) {
  return { multi_select: names.map((name) => ({ name })) };
}

function categoryName(value: string): string {
  const normalized = value.trim().toLowerCase();
  const mapping: Record<string, string> = {
    beauty: "Beauty",
    fashion: "Fashion",
    lifestyle: "Lifestyle",
    food: "Food",
    haushalt: "Haushalt",
    household: "Haushalt",
    technik: "Technik",
    tech: "Technik",
    electronics: "Electronics",
    fitness: "Fitness",
    gaming: "Gaming",
    familie: "Familie",
    family: "Familie",
    entertainment: "Entertainment",
    "home & living": "Home & Living",
    home: "Home & Living",
    "health & wellness": "Health & Wellness",
    health: "Health & Wellness",
    sport: "Sport",
    sports: "Sport",
    pet: "Pet",
    pets: "Pet",
  };
  return mapping[normalized] ?? "Sonstiges";
}

function languageName(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["de", "de-de", "deutsch", "german"].includes(normalized)) return "Deutsch";
  if (["en", "en-gb", "en-us", "englisch", "english"].includes(normalized)) return "Englisch";
  if (normalized.includes("de") && normalized.includes("en")) return "Deutsch & Englisch";
  return "Andere";
}

function marketName(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["de", "de-de", "germany", "deutschland"].includes(normalized)) return "Deutschland";
  if (["eu", "european union", "eu (andere)"].includes(normalized)) return "EU (andere)";
  return null;
}

function creatorProfileProperties(profile: CreatorProfile): Record<string, unknown> {
  const categories = profile.niche?.length
    ? [...new Set(profile.niche.map(categoryName))]
    : [];
  const language = languageName(profile.language);
  const market = marketName(profile.market);

  return {
    "Platform Creator ID": richText(profile.id),
    "TikTok Name": title(profile.displayName?.trim() || `@${profile.tiktokHandle}`),
    "TikTok Handle": richText(profile.tiktokHandle),
    "Profil URL": { url: `https://www.tiktok.com/@${encodeURIComponent(profile.tiktokHandle)}` },
    ...(categories.length ? { Kategorie: multiSelect(categories) } : {}),
    ...(language ? { "Content-Sprache": select(language) } : {}),
    ...(market ? { "Account-Region": select(market) } : {}),
  };
}

function creatorCreateProperties(profile: CreatorProfile): Record<string, unknown> {
  return {
    ...creatorProfileProperties(profile),
    "Mindestens 18 Jahre": checkbox(true),
    "Datenschutz bestätigt": checkbox(true),
    "Bewerbung Quelle": select("Website"),
    "Status": select("Beworben"),
    "Intake-Stage": select("Neu – Runde 1"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pageId(value: unknown): string | null {
  return isRecord(value) && typeof value.id === "string" && value.id.trim() ? value.id : null;
}

export class NotionCreatorOperationsSync implements CreatorOperationsSyncPort {
  private readonly token: string;
  private readonly dataSourceId: string;

  constructor(
    config: NotionCreatorSyncConfig,
    private readonly notionFetch: NotionFetch = (input, init) => fetch(input, init),
  ) {
    this.token = config.token.trim();
    if (!this.token) throw new Error("NOTION_TOKEN_REQUIRED");
    this.dataSourceId = cleanDataSourceId(config.dataSourceId);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    };
  }

  private async updatePage(id: string, profile: CreatorProfile): Promise<boolean> {
    const response = await this.notionFetch(`${NOTION_API_ORIGIN}/v1/pages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ properties: creatorProfileProperties(profile) }),
    });
    if (response.ok) return true;
    if (response.status === 404) return false;
    throw new Error(`NOTION_CREATOR_UPDATE_FAILED:${response.status}`);
  }

  private async findPage(profileId: string): Promise<string | null> {
    const response = await this.notionFetch(`${NOTION_API_ORIGIN}/v1/data_sources/${encodeURIComponent(this.dataSourceId)}/query`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        page_size: 2,
        filter: {
          property: "Platform Creator ID",
          rich_text: { equals: profileId },
        },
      }),
    });
    if (!response.ok) throw new Error(`NOTION_CREATOR_QUERY_FAILED:${response.status}`);

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.results)) throw new Error("NOTION_CREATOR_QUERY_RESPONSE_INVALID");
    const ids = payload.results.map(pageId).filter((id): id is string => Boolean(id));
    if (ids.length > 1) throw new Error("NOTION_CREATOR_DUPLICATE_PLATFORM_ID");
    return ids[0] ?? null;
  }

  private async createPage(profile: CreatorProfile): Promise<string> {
    const response = await this.notionFetch(`${NOTION_API_ORIGIN}/v1/pages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: this.dataSourceId },
        properties: creatorCreateProperties(profile),
      }),
    });
    if (!response.ok) throw new Error(`NOTION_CREATOR_CREATE_FAILED:${response.status}`);

    const id = pageId(await response.json());
    if (!id) throw new Error("NOTION_CREATOR_CREATE_RESPONSE_INVALID");
    return id;
  }

  async syncCreatorProfile(profile: CreatorProfile): Promise<{ creatorMasterId?: string }> {
    const existingMasterId = profile.creatorMasterId?.trim();
    if (existingMasterId && await this.updatePage(existingMasterId, profile)) {
      return { creatorMasterId: existingMasterId };
    }

    const matchedPageId = await this.findPage(profile.id);
    if (matchedPageId) {
      await this.updatePage(matchedPageId, profile);
      return { creatorMasterId: matchedPageId };
    }

    return { creatorMasterId: await this.createPage(profile) };
  }
}
