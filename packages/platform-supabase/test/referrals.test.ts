import { describe, expect, it } from "vitest";
import { loadAllCreatorReferrals } from "../src/referrals.js";

function row(id: string, owner = "creator-1") {
  return {
    id,
    referrer_creator_profile_id: owner,
    referred_creator_profile_id: `referred-${id}`,
    referral_code: "GMVABC123",
    status: "attributed",
    attributed_at: "2026-09-16T10:00:00.000Z",
    qualified_at: null,
    contracted_at: null,
    activated_at: null,
    performing_at: null,
    fraud_flags: [],
    created_at: "2026-09-16T10:00:00.000Z",
    updated_at: "2026-09-16T10:00:00.000Z",
  };
}

describe("loadAllCreatorReferrals", () => {
  it("loads every page instead of truncating at the first page", async () => {
    const ranges: Array<[number, number]> = [];
    const result = await loadAllCreatorReferrals(
      "creator-1",
      async ({ from, to }) => {
        ranges.push([from, to]);
        if (from === 0) return [row("1"), row("2")];
        if (from === 2) return [row("3")];
        return [];
      },
      { pageSize: 2, maxPages: 5 },
    );

    expect(result.map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(ranges).toEqual([[0, 1], [2, 3]]);
  });

  it("fails closed if a page returns another referrer", async () => {
    await expect(loadAllCreatorReferrals(
      "creator-1",
      async () => [row("1", "creator-2")],
      { pageSize: 2, maxPages: 2 },
    )).rejects.toThrow("CREATOR_REFERRAL_OWNER_MISMATCH");
  });

  it("fails closed on duplicate rows across pages", async () => {
    await expect(loadAllCreatorReferrals(
      "creator-1",
      async ({ from }) => from === 0 ? [row("1")] : [row("1")],
      { pageSize: 1, maxPages: 2 },
    )).rejects.toThrow("CREATOR_REFERRAL_DUPLICATE_ROW");
  });

  it("fails closed when the configured pagination cap is exhausted", async () => {
    await expect(loadAllCreatorReferrals(
      "creator-1",
      async ({ from }) => [row(String(from + 1))],
      { pageSize: 1, maxPages: 2 },
    )).rejects.toThrow("CREATOR_REFERRAL_PAGINATION_LIMIT_REACHED");
  });
});
