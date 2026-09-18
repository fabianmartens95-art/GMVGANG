import { describe, expect, it } from "vitest";
import {
  HttpCreatorSampleTrackingAdapter,
  parseCreatorSampleTracking,
  renderCreatorSampleTracking,
} from "../src/creator-sample-tracking.js";

const SHIPPED = {
  campaignId: "campaign-1",
  campaignName: "Beauty <Launch>",
  status: "shipped",
  requestedAt: "2026-09-18T08:00:00.000Z",
  approvedAt: "2026-09-18T09:00:00.000Z",
  shippedAt: "2026-09-18T10:00:00.000Z",
  deliveredAt: null,
  lastEventAt: "2026-09-18T10:00:00.000Z",
  fulfillmentReference: "TRACK-<123>",
};

describe("Creator Sample Tracking surface", () => {
  it("renders canonical tracking milestones read-only", () => {
    const html = renderCreatorSampleTracking(parseCreatorSampleTracking({
      samples: [SHIPPED],
    }));

    expect(html).toContain("Versendet");
    expect(html).toContain("TRACK-&lt;123&gt;");
    expect(html).toContain("Beauty &lt;Launch&gt;");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-action");
    expect(html).not.toContain("<form");
  });

  it("fails closed on impossible lifecycle/timestamp combinations", () => {
    expect(() => parseCreatorSampleTracking({
      samples: [{
        ...SHIPPED,
        status: "delivered",
        deliveredAt: null,
      }],
    })).toThrow("CREATOR_SAMPLE_TRACKING_STATE_INCONSISTENT");

    expect(() => parseCreatorSampleTracking({
      samples: [{
        ...SHIPPED,
        shippedAt: "2026-09-18T07:00:00.000Z",
      }],
    })).toThrow("CREATOR_SAMPLE_TRACKING_TIMESTAMP_INVALID");

    expect(() => parseCreatorSampleTracking({
      samples: [{
        ...SHIPPED,
        lastEventAt: "2026-09-18T09:30:00.000Z",
      }],
    })).toThrow("CREATOR_SAMPLE_TRACKING_TIMESTAMP_INVALID");
  });

  it("rejects unknown states and duplicate Campaign rows", () => {
    expect(() => parseCreatorSampleTracking({
      samples: [{ ...SHIPPED, status: "lost" }],
    })).toThrow("CREATOR_SAMPLE_TRACKING_ROW_INVALID");

    expect(() => parseCreatorSampleTracking({
      samples: [SHIPPED, { ...SHIPPED }],
    })).toThrow("CREATOR_SAMPLE_TRACKING_DUPLICATE_CAMPAIGN");
  });

  it("rejects address, contact, tracking-url and other non-projected fields", () => {
    for (const extra of [
      { shippingAddress: "Private address" },
      { phone: "+491234" },
      { recipientName: "Creator Name" },
      { trackingUrl: "https://carrier.example/track" },
      { email: "creator@example.com" },
    ]) {
      expect(() => parseCreatorSampleTracking({
        samples: [{ ...SHIPPED, ...extra }],
      })).toThrow("CREATOR_SAMPLE_TRACKING_ROW_INVALID");
    }
  });

  it("supports a pristine not-requested state without invented fulfillment data", () => {
    const response = parseCreatorSampleTracking({
      samples: [{
        campaignId: "campaign-2",
        campaignName: "No Sample Yet",
        status: "not_requested",
        requestedAt: null,
        approvedAt: null,
        shippedAt: null,
        deliveredAt: null,
        lastEventAt: null,
        fulfillmentReference: null,
      }],
    });
    expect(response.samples[0]?.status).toBe("not_requested");
  });

  it("keeps Creator identity server-derived with no browser selector", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorSampleTrackingAdapter(
      "/api/creator/samples",
      async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          async json() { return { samples: [SHIPPED] }; },
        };
      },
    );

    await expect(adapter.getSamples()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/samples",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("degrades malformed server data to unavailable", async () => {
    const adapter = new HttpCreatorSampleTrackingAdapter(
      "/api/creator/samples",
      async () => ({
        ok: true,
        async json() {
          return { samples: [{ campaignId: "bad", shippingAddress: "PII" }] };
        },
      }),
    );

    await expect(adapter.getSamples()).resolves.toBeNull();
    expect(renderCreatorSampleTracking(null)).toContain(
      "Sample-Status nicht verfügbar",
    );
  });
});
