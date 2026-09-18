import { describe, expect, it } from "vitest";
import { CompanyOsCreatorWorkspaceReadPort } from "../src/company-os-creator-workspace.js";

const CREATOR_A = "11111111-1111-1111-1111-111111111111";
const CREATOR_B = "22222222-2222-2222-2222-222222222222";
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

function creator(id: string, status = "Aktiv") {
  return {
    id,
    last_edited_time: "2026-09-16T18:00:00.000Z",
    properties: {
      Status: select(status),
      "Legal Hold": checkbox(false),
      "Creator nicht aufnehmen": checkbox(false),
      Raus: checkbox(false),
      "Compliance-Risiko": select("Kein Risiko"),
      "TikTok Verstöße 90 Tage": select("Nein"),
      "Compliance Check bestanden": checkbox(true),
      "Vertrag unterschrieben am": date("2026-09-10"),
      Email: { email: "must-not-enter-workspace-store@example.com" },
    },
  };
}

function campaign(id: string, key: string, approved = true) {
  return {
    id,
    last_edited_time: "2026-09-16T18:05:00.000Z",
    properties: {
      Campaign: title(`Campaign ${key}`),
      "Campaign Key": rich(key),
      Status: select("Active"),
      "Client Approved": checkbox(approved),
      "Launched At": date("2026-09-16T12:00:00.000Z"),
      "Completed At": date(null),
      "Internal Notes": rich("must not be projected"),
    },
  };
}

function assignment(id: string, creatorId: string, campaignId: string, outreach: string, gmv: number) {
  return {
    id,
    last_edited_time: "2026-09-16T18:10:00.000Z",
    properties: {
      Creator: relation(creatorId),
      Campaign: relation(campaignId),
      "Outreach Status": select(outreach),
      "Sample Status": select("Not Requested"),
      "Content Status": select("Not Started"),
      "Posted At": date(null),
      GMV: number(gmv),
      Orders: number(gmv / 100),
      Commission: number(gmv / 10),
      "Private Brief": rich("must not be projected"),
    },
  };
}

describe("CompanyOsCreatorWorkspaceReadPort", () => {
  it("fails closed until all three Company OS snapshots have arrived", async () => {
    const port = new CompanyOsCreatorWorkspaceReadPort();
    port.replaceSource("creators", [creator(CREATOR_A)], "2026-09-16T18:20:00.000Z");

    await expect(port.readForCreator({ creatorMasterId: CREATOR_A, now: "2026-09-16T18:30:00.000Z" }))
      .rejects.toThrow("COMPANY_OS_CREATOR_WORKSPACE_SOURCE_NOT_READY");
  });

  it("isolates assignments by the stable Creator relation and derives a creator-safe snapshot", async () => {
    const port = new CompanyOsCreatorWorkspaceReadPort();
    port.replaceSource("creators", [creator(CREATOR_A), creator(CREATOR_B, "Screening")], "2026-09-16T18:20:00.000Z");
    port.replaceSource("campaigns", [campaign(CAMPAIGN_A, "campaign-a"), campaign(CAMPAIGN_B, "campaign-b")], "2026-09-16T18:21:00.000Z");
    port.replaceSource("assignments", [
      assignment("assignment-a", CREATOR_A, CAMPAIGN_A, "Ready", 1000),
      assignment("assignment-b", CREATOR_B, CAMPAIGN_B, "Accepted", 5000),
    ], "2026-09-16T18:22:00.000Z");

    const snapshot = await port.readForCreator({ creatorMasterId: CREATOR_A, now: "2026-09-16T18:30:00.000Z" });

    expect(snapshot.assignments).toHaveLength(1);
    expect(snapshot.assignments[0]).toMatchObject({
      campaign: {
        id: "campaign-a",
        name: "Campaign campaign-a",
        status: "active",
        clientApproved: true,
      },
      creatorReady: true,
      outreachStatus: "ready",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
      operationalPerformance: { gmV: 1000, orders: 10, commission: 100 },
    });
    expect(snapshot.syncedAt).toBe("2026-09-16T18:20:00.000Z");
  });

  it("fails closed when an assignment references a campaign missing from the sanitized campaign snapshot", async () => {
    const port = new CompanyOsCreatorWorkspaceReadPort();
    port.replaceSource("creators", [creator(CREATOR_A)], "2026-09-16T18:20:00.000Z");
    port.replaceSource("campaigns", [], "2026-09-16T18:20:00.000Z");
    port.replaceSource("assignments", [
      assignment("assignment-a", CREATOR_A, CAMPAIGN_A, "Ready", 0),
    ], "2026-09-16T18:20:00.000Z");

    await expect(port.readForCreator({ creatorMasterId: CREATOR_A, now: "2026-09-16T18:30:00.000Z" }))
      .rejects.toThrow("COMPANY_OS_CREATOR_WORKSPACE_CAMPAIGN_MISSING");
  });

  it("does not promote unknown states into a visible executable state", async () => {
    const port = new CompanyOsCreatorWorkspaceReadPort();
    const unknownCampaign = campaign(CAMPAIGN_A, "campaign-a");
    unknownCampaign.properties.Status = select("Unknown");
    const unknownAssignment = assignment("assignment-a", CREATOR_A, CAMPAIGN_A, "Unknown", 0);
    unknownAssignment.properties["Sample Status"] = select("Unknown");
    unknownAssignment.properties["Content Status"] = select("Unknown");

    port.replaceSource("creators", [creator(CREATOR_A)], "2026-09-16T18:20:00.000Z");
    port.replaceSource("campaigns", [unknownCampaign], "2026-09-16T18:20:00.000Z");
    port.replaceSource("assignments", [unknownAssignment], "2026-09-16T18:20:00.000Z");

    const snapshot = await port.readForCreator({ creatorMasterId: CREATOR_A, now: "2026-09-16T18:30:00.000Z" });
    expect(snapshot.assignments[0]).toMatchObject({
      campaign: { status: "draft" },
      outreachStatus: "stopped",
      sampleStatus: "not_requested",
      contentStatus: "not_started",
    });
  });
});
