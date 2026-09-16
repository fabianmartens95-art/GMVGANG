import { describe, expect, it } from "vitest";
import {
  NotionCreatorWorkspaceReadPort,
  type NotionWorkspaceFetch,
} from "../src/notion-creator-workspace.js";

const CREATOR_ID = "11111111-1111-1111-1111-111111111111";
const ASSIGNMENT_DS = "22222222-2222-2222-2222-222222222222";
const CAMPAIGN_A = "33333333-3333-3333-3333-333333333333";
const CAMPAIGN_B = "44444444-4444-4444-4444-444444444444";

function text(content: string) {
  return [{ plain_text: content }];
}
function rich(content: string) {
  return { rich_text: text(content) };
}
function title(content: string) {
  return { title: text(content) };
}
function select(name: string) {
  return { select: { name } };
}
function checkbox(value: boolean) {
  return { checkbox: value };
}
function date(value: string | null) {
  return { date: value ? { start: value } : null };
}
function relation(id: string) {
  return { relation: [{ id }] };
}
function number(value: number) {
  return { number: value };
}

function creatorPage() {
  return {
    id: CREATOR_ID,
    last_edited_time: "2026-09-16T17:00:00.000Z",
    properties: {
      Status: select("Aktiv"),
      "Legal Hold": checkbox(false),
      "Creator nicht aufnehmen": checkbox(false),
      Raus: checkbox(false),
      "Compliance-Risiko": select("Kein Risiko"),
      "TikTok Verstöße 90 Tage": select("Nein"),
      "Compliance Check bestanden": checkbox(true),
      "Vertrag unterschrieben am": date("2026-09-10"),
    },
  };
}

function campaign(id: string, key: string, approved: boolean) {
  return {
    id,
    last_edited_time: "2026-09-16T18:00:00.000Z",
    properties: {
      Campaign: title(`Campaign ${key}`),
      "Campaign Key": rich(key),
      Status: select("Active"),
      "Client Approved": checkbox(approved),
      "Launched At": date("2026-09-16T12:00:00.000Z"),
      "Completed At": date(null),
    },
  };
}

function assignment(id: string, campaignId: string, outreach: string, gmv: number) {
  return {
    id,
    last_edited_time: "2026-09-16T18:15:00.000Z",
    properties: {
      Campaign: relation(campaignId),
      "Outreach Status": select(outreach),
      "Sample Status": select("Not Requested"),
      "Content Status": select("Not Started"),
      "Posted At": date(null),
      GMV: number(gmv),
      Orders: number(gmv / 100),
      Commission: number(gmv / 10),
    },
  };
}

function response(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

describe("NotionCreatorWorkspaceReadPort", () => {
  it("reads only the stable creator relation and follows Notion pagination", async () => {
    const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    const fetcher: NotionWorkspaceFetch = async (url, init) => {
      const body = init.body ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      requests.push({ url, method: init.method, ...(body ? { body } : {}) });

      if (url.endsWith(`/v1/pages/${CREATOR_ID}`)) return response(creatorPage());
      if (url.endsWith(`/v1/pages/${CAMPAIGN_A}`)) return response(campaign(CAMPAIGN_A, "campaign-a", true));
      if (url.endsWith(`/v1/pages/${CAMPAIGN_B}`)) return response(campaign(CAMPAIGN_B, "campaign-b", false));
      if (url.includes(`/v1/data_sources/${ASSIGNMENT_DS}/query`)) {
        if (body?.start_cursor === "cursor-2") {
          return response({ results: [assignment("assignment-b", CAMPAIGN_B, "Sent", 500)], has_more: false, next_cursor: null });
        }
        return response({ results: [assignment("assignment-a", CAMPAIGN_A, "Accepted", 1000)], has_more: true, next_cursor: "cursor-2" });
      }
      return response({}, 404);
    };

    const port = new NotionCreatorWorkspaceReadPort({
      token: "secret",
      assignmentDataSourceId: ASSIGNMENT_DS,
    }, fetcher);
    const snapshot = await port.readForCreator({ creatorMasterId: CREATOR_ID, now: "2026-09-16T18:30:00.000Z" });

    expect(snapshot.assignments).toHaveLength(2);
    expect(snapshot.assignments[0]).toMatchObject({
      campaign: { id: "campaign-a", clientApproved: true, status: "active" },
      creatorReady: true,
      outreachStatus: "accepted",
      operationalPerformance: { gmV: 1000, orders: 10, commission: 100 },
    });
    expect(snapshot.assignments[1]).toMatchObject({
      campaign: { id: "campaign-b", clientApproved: false },
      outreachStatus: "sent",
    });
    expect(snapshot.syncedAt).toBe("2026-09-16T18:15:00.000Z");

    const queryRequests = requests.filter((item) => item.method === "POST");
    expect(queryRequests).toHaveLength(2);
    expect(queryRequests[0]?.body).toMatchObject({
      page_size: 100,
      filter: { property: "Creator", relation: { contains: CREATOR_ID } },
    });
    expect(queryRequests[1]?.body).toMatchObject({ start_cursor: "cursor-2" });
  });

  it("fails closed on malformed pagination instead of returning a partial workspace", async () => {
    const fetcher: NotionWorkspaceFetch = async (url) => {
      if (url.endsWith(`/v1/pages/${CREATOR_ID}`)) return response(creatorPage());
      return response({ results: [], has_more: true, next_cursor: null });
    };
    const port = new NotionCreatorWorkspaceReadPort({ token: "secret", assignmentDataSourceId: ASSIGNMENT_DS }, fetcher);
    await expect(port.readForCreator({ creatorMasterId: CREATOR_ID, now: "2026-09-16T18:30:00.000Z" }))
      .rejects.toThrow("NOTION_CREATOR_ASSIGNMENT_CURSOR_MISSING");
  });

  it("does not treat unknown operational states as a visible opportunity", async () => {
    const fetcher: NotionWorkspaceFetch = async (url) => {
      if (url.endsWith(`/v1/pages/${CREATOR_ID}`)) return response(creatorPage());
      if (url.endsWith(`/v1/pages/${CAMPAIGN_A}`)) {
        return response({
          ...campaign(CAMPAIGN_A, "campaign-a", true),
          properties: { ...campaign(CAMPAIGN_A, "campaign-a", true).properties, Status: select("Unknown") },
        });
      }
      return response({
        results: [{
          ...assignment("assignment-a", CAMPAIGN_A, "Unknown", 0),
          properties: {
            ...assignment("assignment-a", CAMPAIGN_A, "Unknown", 0).properties,
            "Sample Status": select("Unknown"),
            "Content Status": select("Unknown"),
          },
        }],
        has_more: false,
      });
    };
    const port = new NotionCreatorWorkspaceReadPort({ token: "secret", assignmentDataSourceId: ASSIGNMENT_DS }, fetcher);
    const snapshot = await port.readForCreator({ creatorMasterId: CREATOR_ID, now: "2026-09-16T18:30:00.000Z" });
    expect(snapshot.assignments[0]).toMatchObject({
      campaign: { status: "draft" },
      outreachStatus: "stopped",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
    });
  });
});
