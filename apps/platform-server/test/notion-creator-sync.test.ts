import { describe, expect, it } from "vitest";

import { NotionCreatorOperationsSync, type NotionFetch } from "../src/notion-creator-sync.js";

const PROFILE = {
  id: "creator-profile-1",
  userId: "user-1",
  tiktokHandle: "creator.one",
  displayName: "Creator One",
  market: "DE",
  language: "de",
  niche: ["beauty", "tech"],
  networkStatus: "profile_complete" as const,
  profileCompletionPercent: 100,
  referralCode: "GMVABC123",
  createdAt: "2026-09-16T14:00:00.000Z",
  updatedAt: "2026-09-16T14:05:00.000Z",
};

function response(status: number, payload: unknown = {}): Awaited<ReturnType<NotionFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

describe("NotionCreatorOperationsSync", () => {
  it("queries by stable Platform Creator ID and initializes lifecycle fields only when creating a missing operational row", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
    const fetcher: NotionFetch = async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) as Record<string, unknown>, headers: init.headers });
      if (url.includes("/query")) return response(200, { results: [] });
      return response(200, { id: "notion-page-1" });
    };

    const sync = new NotionCreatorOperationsSync({
      token: "secret-token",
      dataSourceId: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    }, fetcher);

    await expect(sync.syncCreatorProfile(PROFILE)).resolves.toEqual({ creatorMasterId: "notion-page-1" });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain("/v1/data_sources/8a6eb54f-cefc-4f5b-bda6-57998fd09904/query");
    expect(requests[0]?.body).toEqual({
      page_size: 2,
      filter: {
        property: "Platform Creator ID",
        rich_text: { equals: "creator-profile-1" },
      },
    });
    expect(requests[0]?.headers.Authorization).toBe("Bearer secret-token");
    expect(requests[0]?.headers["Notion-Version"]).toBe("2026-03-11");

    const createProperties = (requests[1]?.body.properties ?? {}) as Record<string, unknown>;
    expect(createProperties["Platform Creator ID"]).toEqual({
      rich_text: [{ type: "text", text: { content: "creator-profile-1" } }],
    });
    expect(createProperties["Bewerbung Quelle"]).toEqual({ select: { name: "Website" } });
    expect(createProperties.Status).toEqual({ select: { name: "Beworben" } });
    expect(createProperties["Intake-Stage"]).toEqual({ select: { name: "Neu – Runde 1" } });
    expect(createProperties["Mindestens 18 Jahre"]).toEqual({ checkbox: true });
    expect(createProperties["Datenschutz bestätigt"]).toEqual({ checkbox: true });
  });

  it("updates profile fields on a linked Creator without overwriting operational lifecycle or intake state", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: NotionFetch = async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      return response(200, { id: "notion-page-1" });
    };
    const sync = new NotionCreatorOperationsSync({
      token: "secret-token",
      dataSourceId: "collection://8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    }, fetcher);

    await expect(sync.syncCreatorProfile({ ...PROFILE, creatorMasterId: "notion-page-1" })).resolves.toEqual({
      creatorMasterId: "notion-page-1",
    });
    expect(requests.map((request) => request.url)).toEqual(["https://api.notion.com/v1/pages/notion-page-1"]);

    const updateProperties = (requests[0]?.body.properties ?? {}) as Record<string, unknown>;
    expect(updateProperties["TikTok Name"]).toEqual({
      title: [{ type: "text", text: { content: "Creator One" } }],
    });
    expect(updateProperties["TikTok Handle"]).toEqual({
      rich_text: [{ type: "text", text: { content: "creator.one" } }],
    });
    expect(updateProperties.Kategorie).toEqual({
      multi_select: [{ name: "Beauty" }, { name: "Technik" }],
    });
    expect(updateProperties.Status).toBeUndefined();
    expect(updateProperties["Intake-Stage"]).toBeUndefined();
    expect(updateProperties["Bewerbung Quelle"]).toBeUndefined();
    expect(updateProperties["Mindestens 18 Jahre"]).toBeUndefined();
    expect(updateProperties["Datenschutz bestätigt"]).toBeUndefined();
  });

  it("also preserves lifecycle fields when an existing row is found by Platform Creator ID", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: NotionFetch = async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      if (url.includes("/query")) return response(200, { results: [{ id: "notion-page-1" }] });
      return response(200, { id: "notion-page-1" });
    };
    const sync = new NotionCreatorOperationsSync({
      token: "secret-token",
      dataSourceId: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    }, fetcher);

    await expect(sync.syncCreatorProfile(PROFILE)).resolves.toEqual({ creatorMasterId: "notion-page-1" });
    expect(requests).toHaveLength(2);
    const updateProperties = (requests[1]?.body.properties ?? {}) as Record<string, unknown>;
    expect(updateProperties.Status).toBeUndefined();
    expect(updateProperties["Intake-Stage"]).toBeUndefined();
  });

  it("fails closed on duplicate operational rows for the same Platform Creator ID", async () => {
    const fetcher: NotionFetch = async () => response(200, {
      results: [{ id: "notion-page-1" }, { id: "notion-page-2" }],
    });
    const sync = new NotionCreatorOperationsSync({
      token: "secret-token",
      dataSourceId: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    }, fetcher);

    await expect(sync.syncCreatorProfile(PROFILE)).rejects.toThrow("NOTION_CREATOR_DUPLICATE_PLATFORM_ID");
  });
});
