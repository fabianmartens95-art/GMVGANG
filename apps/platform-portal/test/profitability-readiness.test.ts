import { describe, expect, it } from "vitest";
import {
  HttpProfitabilityReadinessAdapter,
  parseProfitabilityReadiness,
  renderProfitabilityReadiness,
} from "../src/profitability-readiness.js";

describe("Profitability Input Readiness surface", () => {
  it("keeps missing inputs distinct from explicit zero values", () => {
    const response = parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["paidMediaCost"],
      explicitZeroInputs: ["otherVariableCosts"],
    });

    const html = renderProfitabilityReadiness(response);
    expect(html).toContain("Fehlende Inputs");
    expect(html).toContain("Paid Media");
    expect(html).toContain("Explizit als 0 erfasste Inputs");
    expect(html).toContain("Sonstige variable Kosten");
    expect(html).toContain("werden nicht als 0 interpretiert");
  });

  it("renders readiness without calculating or claiming profit", () => {
    const html = renderProfitabilityReadiness(parseProfitabilityReadiness({
      status: "ready",
      readyForFullProfitability: true,
      missing: [],
      explicitZeroInputs: ["otherVariableCosts"],
    }));

    expect(html).toContain("Inputs vollständig");
    expect(html).toContain("berechnet weiterhin keinen Profit");
    expect(html).not.toContain("Contribution Margin");
    expect(html).not.toContain("ROAS");
    expect(html).not.toContain("€");
  });

  it("fails closed on inconsistent ready/incomplete states", () => {
    expect(() => parseProfitabilityReadiness({
      status: "ready",
      readyForFullProfitability: false,
      missing: [],
      explicitZeroInputs: [],
    })).toThrow("PROFITABILITY_READINESS_STATE_INCONSISTENT");

    expect(() => parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: [],
      explicitZeroInputs: [],
    })).toThrow("PROFITABILITY_READINESS_STATE_INCONSISTENT");
  });

  it("rejects unknown, duplicate, out-of-order, or overlapping input keys", () => {
    expect(() => parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["secretCost"],
      explicitZeroInputs: [],
    })).toThrow("PROFITABILITY_READINESS_INPUT_KEYS_INVALID");

    expect(() => parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["cogs", "cogs"],
      explicitZeroInputs: [],
    })).toThrow("PROFITABILITY_READINESS_INPUT_KEYS_INVALID");

    expect(() => parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["paidMediaCost", "cogs"],
      explicitZeroInputs: [],
    })).toThrow("PROFITABILITY_READINESS_INPUT_KEYS_INVALID");

    expect(() => parseProfitabilityReadiness({
      status: "incomplete",
      readyForFullProfitability: false,
      missing: ["paidMediaCost"],
      explicitZeroInputs: ["paidMediaCost"],
    })).toThrow("PROFITABILITY_READINESS_INPUT_OVERLAP");
  });

  it("keeps organization selection in the authenticated header boundary", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpProfitabilityReadinessAdapter(
      "org-1",
      "/api/brand/profitability/readiness",
      async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          async json() {
            return {
              status: "ready",
              readyForFullProfitability: true,
              missing: [],
              explicitZeroInputs: [],
            };
          },
        };
      },
    );

    await expect(adapter.getReadiness()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/brand/profitability/readiness",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-GMVGANG-Organization-Id": "org-1",
        },
      },
    }]);
  });

  it("does not issue a request without organization context", async () => {
    let called = false;
    const adapter = new HttpProfitabilityReadinessAdapter(
      " ",
      "/api/brand/profitability/readiness",
      async () => {
        called = true;
        return {
          ok: true,
          async json() {
            return {
              status: "ready",
              readyForFullProfitability: true,
              missing: [],
              explicitZeroInputs: [],
            };
          },
        };
      },
    );

    await expect(adapter.getReadiness()).resolves.toBeNull();
    expect(called).toBe(false);
  });

  it("degrades malformed HTTP responses to unavailable", async () => {
    const adapter = new HttpProfitabilityReadinessAdapter(
      "org-1",
      "/api/brand/profitability/readiness",
      async () => ({
        ok: true,
        async json() { return { status: "ready", readyForFullProfitability: true }; },
      }),
    );

    await expect(adapter.getReadiness()).resolves.toBeNull();
    expect(renderProfitabilityReadiness(null)).toContain("Datenstatus nicht verfügbar");
  });
});
