import { describe, expect, it } from "vitest";

import {
  normalizeContentSubmissionUrl,
  planContentSubmissionTransition,
} from "./index.js";

const NOW = "2026-09-18T12:00:00.000Z";

describe("Content submission URL normalization", () => {
  it("accepts HTTPS URLs and strips fragments", () => {
    expect(normalizeContentSubmissionUrl(
      " https://www.tiktok.com/@creator/video/123#comments ",
    )).toBe("https://www.tiktok.com/@creator/video/123");
  });

  it("rejects non-HTTPS, malformed and credential-bearing URLs", () => {
    expect(() => normalizeContentSubmissionUrl("javascript:alert(1)"))
      .toThrow("CONTENT_URL_PROTOCOL_INVALID");
    expect(() => normalizeContentSubmissionUrl("http://example.com/video"))
      .toThrow("CONTENT_URL_PROTOCOL_INVALID");
    expect(() => normalizeContentSubmissionUrl("https://user:pass@example.com/video"))
      .toThrow("CONTENT_URL_CREDENTIALS_FORBIDDEN");
    expect(() => normalizeContentSubmissionUrl("not a url"))
      .toThrow("CONTENT_URL_INVALID");
  });
});

describe("Content submission lifecycle", () => {
  it("requires draft content to be submitted before review", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "draft",
      targetStatus: "submitted",
      now: NOW,
    })).toEqual({
      ok: true,
      status: "submitted",
      reviewedAt: null,
      publishedAt: null,
      rejectionReason: null,
      event: "content.submitted",
    });

    expect(planContentSubmissionTransition({
      currentStatus: "draft",
      targetStatus: "approved",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_TRANSITION_DENIED" });
  });

  it("requires a rejection reason and records review time", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "submitted",
      targetStatus: "rejected",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_REJECTION_REASON_REQUIRED" });

    expect(planContentSubmissionTransition({
      currentStatus: "submitted",
      targetStatus: "rejected",
      rejectionReason: "  Hook mentions the wrong product. ",
      now: NOW,
    })).toEqual({
      ok: true,
      status: "rejected",
      reviewedAt: NOW,
      publishedAt: null,
      rejectionReason: "Hook mentions the wrong product.",
      event: "content.rejected",
    });
  });

  it("supports resubmission after rejection and clears prior review state", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "rejected",
      targetStatus: "submitted",
      currentReviewedAt: "2026-09-18T11:00:00.000Z",
      rejectionReason: "old",
      now: NOW,
    })).toEqual({
      ok: true,
      status: "submitted",
      reviewedAt: null,
      publishedAt: null,
      rejectionReason: null,
      event: "content.resubmitted",
    });
  });

  it("requires approval with a valid review timestamp before publication", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "submitted",
      targetStatus: "published",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_TRANSITION_DENIED" });

    expect(planContentSubmissionTransition({
      currentStatus: "approved",
      targetStatus: "published",
      currentReviewedAt: "2026-09-18T11:00:00.000Z",
      now: NOW,
    })).toEqual({
      ok: true,
      status: "published",
      reviewedAt: "2026-09-18T11:00:00.000Z",
      publishedAt: NOW,
      rejectionReason: null,
      event: "content.published",
    });
  });

  it("fails closed on malformed, future and inconsistent persisted timestamps", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "approved",
      targetStatus: "published",
      currentReviewedAt: "not-a-date",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_TIMESTAMP_INVALID" });

    expect(planContentSubmissionTransition({
      currentStatus: "approved",
      targetStatus: "published",
      currentReviewedAt: "2026-09-18T13:00:00.000Z",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_TIMESTAMP_INVALID" });

    expect(planContentSubmissionTransition({
      currentStatus: "submitted",
      targetStatus: "approved",
      currentReviewedAt: "2026-09-18T11:00:00.000Z",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_STATE_INVALID" });

    expect(planContentSubmissionTransition({
      currentStatus: "rejected",
      targetStatus: "submitted",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_STATE_INVALID" });
  });

  it("treats published content as terminal and rejects malformed current time", () => {
    expect(planContentSubmissionTransition({
      currentStatus: "published",
      targetStatus: "submitted",
      now: NOW,
    })).toEqual({ ok: false, error: "CONTENT_TRANSITION_DENIED" });

    expect(planContentSubmissionTransition({
      currentStatus: "draft",
      targetStatus: "submitted",
      now: "not-a-date",
    })).toEqual({ ok: false, error: "CONTENT_TIMESTAMP_INVALID" });
  });
});
