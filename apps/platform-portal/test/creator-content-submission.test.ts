import { describe, expect, it } from "vitest";
import {
  HttpCreatorContentSubmissionAdapter,
  parseCreatorContentSubmissions,
  renderCreatorContentSubmissions,
} from "../src/creator-content-submission.js";

const APPROVED = {
  contentId: "content-1",
  campaignName: "Beauty <Launch>",
  status: "approved",
  contentUrl: "https://www.tiktok.com/@creator/video/123",
  reviewedAt: "2026-09-18T12:00:00.000Z",
  publishedAt: null,
  rejectionReason: null,
};

describe("Creator Content Submission surface", () => {
  it("renders approved content read-only with a safe external link", () => {
    const html = renderCreatorContentSubmissions(parseCreatorContentSubmissions({
      submissions: [APPROVED],
    }));

    expect(html).toContain("Freigegeben");
    expect(html).toContain("Content öffnen");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-action");
  });

  it("fails closed on unsafe or malformed URLs", () => {
    for (const contentUrl of [
      "http://example.com/video",
      "javascript:alert(1)",
      "https://user:pass@example.com/video",
      "https://example.com/video#fragment",
    ]) {
      expect(() => parseCreatorContentSubmissions({
        submissions: [{ ...APPROVED, contentUrl }],
      })).toThrow("CREATOR_CONTENT_SUBMISSION_URL_INVALID");
    }
  });

  it("fails closed on unknown states", () => {
    expect(() => parseCreatorContentSubmissions({
      submissions: [{ ...APPROVED, status: "archived" }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_ROW_INVALID");
  });

  it("enforces review/publish/rejection state consistency", () => {
    expect(() => parseCreatorContentSubmissions({
      submissions: [{
        ...APPROVED,
        status: "submitted",
        reviewedAt: APPROVED.reviewedAt,
      }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");

    expect(() => parseCreatorContentSubmissions({
      submissions: [{
        ...APPROVED,
        status: "rejected",
        rejectionReason: null,
      }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");

    expect(() => parseCreatorContentSubmissions({
      submissions: [{
        ...APPROVED,
        status: "published",
        publishedAt: null,
      }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
  });

  it("allows drafts without a content URL but requires a URL once submitted", () => {
    expect(parseCreatorContentSubmissions({
      submissions: [{
        contentId: "draft-1",
        campaignName: "Draft",
        status: "draft",
        contentUrl: null,
        reviewedAt: null,
        publishedAt: null,
        rejectionReason: null,
      }],
    }).submissions[0]?.contentUrl).toBeNull();

    expect(() => parseCreatorContentSubmissions({
      submissions: [{
        ...APPROVED,
        status: "submitted",
        contentUrl: null,
        reviewedAt: null,
      }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
  });

  it("rejects duplicate Content IDs", () => {
    expect(() => parseCreatorContentSubmissions({
      submissions: [APPROVED, { ...APPROVED }],
    })).toThrow("CREATOR_CONTENT_SUBMISSION_DUPLICATE_ID");
  });

  it("escapes Campaign and rejection copy", () => {
    const html = renderCreatorContentSubmissions(parseCreatorContentSubmissions({
      submissions: [{
        ...APPROVED,
        status: "rejected",
        rejectionReason: "<script>revise</script>",
      }],
    }));

    expect(html).toContain("Beauty &lt;Launch&gt;");
    expect(html).toContain("&lt;script&gt;revise&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps Creator identity server-derived", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorContentSubmissionAdapter(
      "/api/creator/content/submissions",
      async (input, init) => {
        calls.push({ input, init });
        return { ok: true, async json() { return { submissions: [APPROVED] }; } };
      },
    );

    await expect(adapter.getSubmissions()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/content/submissions",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("degrades malformed HTTP responses to unavailable", async () => {
    const adapter = new HttpCreatorContentSubmissionAdapter(
      "/api/creator/content/submissions",
      async () => ({
        ok: true,
        async json() { return { submissions: [{ contentId: "bad" }] }; },
      }),
    );

    await expect(adapter.getSubmissions()).resolves.toBeNull();
    expect(renderCreatorContentSubmissions(null)).toContain("Status nicht verfügbar");
  });
});
