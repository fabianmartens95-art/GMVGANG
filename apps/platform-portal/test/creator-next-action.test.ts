import { describe, expect, it } from "vitest";
import {
  HttpCreatorNextActionAdapter,
  parseCreatorNextAction,
  renderCreatorNextAction,
} from "../src/creator-next-action.js";

describe("Creator Next Best Action surface", () => {
  it("maps canonical action ids only to existing Creator routes", () => {
    const cases = [
      ["complete_profile", "/creator/profile"],
      ["complete_qualification", "/creator/qualification"],
      ["connect_tiktok", "/creator/onboarding"],
      ["finish_tiktok_connection", "/creator/onboarding"],
      ["refresh_tiktok_connection", "/creator/onboarding"],
      ["reconnect_tiktok", "/creator/onboarding"],
      ["review_campaign_opportunity", "/creator/campaigns"],
      ["submit_campaign_content", "/creator/campaigns"],
      ["review_sample_status", "/creator/campaigns"],
      ["explore_matches", "/creator/matches"],
    ] as const;

    for (const [id, href] of cases) {
      const response = parseCreatorNextAction({
        action: { id, priority: "normal", reason: "Weiter." },
      });
      expect(renderCreatorNextAction(response)).toContain(`href="${href}"`);
    }
  });

  it("rejects browser-invented actions and invalid priorities", () => {
    expect(() => parseCreatorNextAction({
      action: { id: "withdraw_money", priority: "critical", reason: "Nope" },
    })).toThrow("CREATOR_NBA_ACTION_INVALID");

    expect(() => parseCreatorNextAction({
      action: { id: "explore_matches", priority: "urgent", reason: "Nope" },
    })).toThrow("CREATOR_NBA_ACTION_INVALID");
  });

  it("escapes server-derived reason copy", () => {
    const html = renderCreatorNextAction(parseCreatorNextAction({
      action: {
        id: "explore_matches",
        priority: "normal",
        reason: "<img src=x onerror=alert(1)>",
      },
    }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("keeps Creator identity server-derived with no browser Creator selector", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorNextActionAdapter("/api/creator/next-action", async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        async json() {
          return { action: { id: "explore_matches", priority: "normal", reason: "Bereit." } };
        },
      };
    });

    await expect(adapter.getNextAction()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/next-action",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("degrades malformed responses to unavailable", async () => {
    const adapter = new HttpCreatorNextActionAdapter("/api/creator/next-action", async () => ({
      ok: true,
      async json() { return { action: { id: "fake" } }; },
    }));
    await expect(adapter.getNextAction()).resolves.toBeNull();
  });
});
