export type ContentSubmissionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "published";

export type ContentSubmissionTransition =
  | {
      ok: true;
      status: ContentSubmissionStatus;
      reviewedAt: string | null;
      publishedAt: string | null;
      rejectionReason: string | null;
      event:
        | "content.submitted"
        | "content.approved"
        | "content.rejected"
        | "content.resubmitted"
        | "content.published";
    }
  | {
      ok: false;
      error:
        | "CONTENT_TRANSITION_DENIED"
        | "CONTENT_REJECTION_REASON_REQUIRED"
        | "CONTENT_REJECTION_REASON_TOO_LONG"
        | "CONTENT_TIMESTAMP_INVALID"
        | "CONTENT_STATE_INVALID";
    };

const ALLOWED_TRANSITIONS: Record<ContentSubmissionStatus, readonly ContentSubmissionStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["published"],
  rejected: ["submitted"],
  published: [],
};

function normalizeTimestamp(value: string): string | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeOptionalTimestamp(value: string | null | undefined): {
  ok: boolean;
  value: string | null;
} {
  if (value == null || !value.trim()) return { ok: true, value: null };
  const normalized = normalizeTimestamp(value);
  return normalized ? { ok: true, value: normalized } : { ok: false, value: null };
}

export function normalizeContentSubmissionUrl(value: string): string {
  const raw = value.trim();
  if (raw.length < 8 || raw.length > 2048) {
    throw new Error("CONTENT_URL_LENGTH_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("CONTENT_URL_INVALID");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("CONTENT_URL_PROTOCOL_INVALID");
  }
  if (!parsed.hostname) {
    throw new Error("CONTENT_URL_INVALID");
  }
  if (parsed.username || parsed.password) {
    throw new Error("CONTENT_URL_CREDENTIALS_FORBIDDEN");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function planContentSubmissionTransition(input: {
  currentStatus: ContentSubmissionStatus;
  targetStatus: ContentSubmissionStatus;
  now: string;
  rejectionReason?: string | null;
  currentReviewedAt?: string | null;
  currentPublishedAt?: string | null;
}): ContentSubmissionTransition {
  const now = normalizeTimestamp(input.now);
  if (!now) return { ok: false, error: "CONTENT_TIMESTAMP_INVALID" };

  if (!ALLOWED_TRANSITIONS[input.currentStatus].includes(input.targetStatus)) {
    return { ok: false, error: "CONTENT_TRANSITION_DENIED" };
  }

  const reviewed = normalizeOptionalTimestamp(input.currentReviewedAt);
  const published = normalizeOptionalTimestamp(input.currentPublishedAt);
  if (!reviewed.ok || !published.ok) {
    return { ok: false, error: "CONTENT_TIMESTAMP_INVALID" };
  }
  if (
    (reviewed.value && reviewed.value > now) ||
    (published.value && published.value > now)
  ) {
    return { ok: false, error: "CONTENT_TIMESTAMP_INVALID" };
  }

  if (
    (input.currentStatus === "draft" || input.currentStatus === "submitted") &&
    (reviewed.value || published.value)
  ) {
    return { ok: false, error: "CONTENT_STATE_INVALID" };
  }
  if (
    (input.currentStatus === "approved" || input.currentStatus === "rejected") &&
    (!reviewed.value || published.value)
  ) {
    return { ok: false, error: "CONTENT_STATE_INVALID" };
  }

  if (input.targetStatus === "rejected") {
    const reason = input.rejectionReason?.trim() ?? "";
    if (!reason) {
      return { ok: false, error: "CONTENT_REJECTION_REASON_REQUIRED" };
    }
    if (reason.length > 2000) {
      return { ok: false, error: "CONTENT_REJECTION_REASON_TOO_LONG" };
    }

    return {
      ok: true,
      status: "rejected",
      reviewedAt: now,
      publishedAt: null,
      rejectionReason: reason,
      event: "content.rejected",
    };
  }

  if (input.targetStatus === "approved") {
    return {
      ok: true,
      status: "approved",
      reviewedAt: now,
      publishedAt: null,
      rejectionReason: null,
      event: "content.approved",
    };
  }

  if (input.targetStatus === "published") {
    return {
      ok: true,
      status: "published",
      reviewedAt: reviewed.value,
      publishedAt: now,
      rejectionReason: null,
      event: "content.published",
    };
  }

  if (input.targetStatus === "submitted") {
    return {
      ok: true,
      status: "submitted",
      reviewedAt: null,
      publishedAt: null,
      rejectionReason: null,
      event: input.currentStatus === "rejected"
        ? "content.resubmitted"
        : "content.submitted",
    };
  }

  return { ok: false, error: "CONTENT_TRANSITION_DENIED" };
}
