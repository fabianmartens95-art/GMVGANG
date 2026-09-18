export type CreatorContentSubmissionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "published";

export type CreatorContentSubmissionRow = {
  contentId: string;
  campaignName: string;
  status: CreatorContentSubmissionStatus;
  contentUrl: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
};

export type CreatorContentSubmissionResponse = {
  submissions: CreatorContentSubmissionRow[];
};

export interface CreatorContentSubmissionPort {
  getSubmissions(): Promise<CreatorContentSubmissionResponse | null>;
}

type SubmissionFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const STATUSES = new Set<CreatorContentSubmissionStatus>([
  "draft",
  "submitted",
  "approved",
  "rejected",
  "published",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function requiredString(value: unknown, max: number, code: string): string {
  if (typeof value !== "string") throw new Error(code);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) throw new Error(code);
  return cleaned;
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_TIMESTAMP_INVALID");
  }
  return new Date(Date.parse(value)).toISOString();
}

function nullableReason(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("CREATOR_CONTENT_SUBMISSION_REASON_INVALID");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 2000) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_REASON_INVALID");
  }
  return cleaned;
}

function safeContentUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("CREATOR_CONTENT_SUBMISSION_URL_INVALID");
  }
  const raw = value.trim();
  if (raw.length < 8 || raw.length > 2048) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_URL_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("CREATOR_CONTENT_SUBMISSION_URL_INVALID");
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_URL_INVALID");
  }

  return parsed.toString();
}

function assertStateConsistency(row: CreatorContentSubmissionRow): void {
  const { status, contentUrl, reviewedAt, publishedAt, rejectionReason } = row;

  if (status === "draft") {
    if (reviewedAt !== null || publishedAt !== null || rejectionReason !== null) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
    }
    return;
  }

  if (contentUrl === null) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
  }

  if (status === "submitted") {
    if (reviewedAt !== null || publishedAt !== null || rejectionReason !== null) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "approved") {
    if (reviewedAt === null || publishedAt !== null || rejectionReason !== null) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
    }
    return;
  }

  if (status === "rejected") {
    if (reviewedAt === null || publishedAt !== null || rejectionReason === null) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
    }
    return;
  }

  if (
    status === "published" &&
    (reviewedAt === null || publishedAt === null || rejectionReason !== null)
  ) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_STATE_INCONSISTENT");
  }
}

export function parseCreatorContentSubmissions(
  payload: unknown,
): CreatorContentSubmissionResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["submissions"]) ||
    !Array.isArray(payload.submissions)
  ) {
    throw new Error("CREATOR_CONTENT_SUBMISSION_PAYLOAD_INVALID");
  }

  const seen = new Set<string>();
  const submissions = payload.submissions.map((raw): CreatorContentSubmissionRow => {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "contentId",
        "campaignName",
        "status",
        "contentUrl",
        "reviewedAt",
        "publishedAt",
        "rejectionReason",
      ])
    ) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_ROW_INVALID");
    }

    const contentId = requiredString(
      raw.contentId,
      128,
      "CREATOR_CONTENT_SUBMISSION_ROW_INVALID",
    );
    if (seen.has(contentId)) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_DUPLICATE_ID");
    }
    seen.add(contentId);

    if (
      typeof raw.status !== "string" ||
      !STATUSES.has(raw.status as CreatorContentSubmissionStatus)
    ) {
      throw new Error("CREATOR_CONTENT_SUBMISSION_ROW_INVALID");
    }

    const row: CreatorContentSubmissionRow = {
      contentId,
      campaignName: requiredString(
        raw.campaignName,
        256,
        "CREATOR_CONTENT_SUBMISSION_ROW_INVALID",
      ),
      status: raw.status as CreatorContentSubmissionStatus,
      contentUrl: safeContentUrl(raw.contentUrl),
      reviewedAt: nullableTimestamp(raw.reviewedAt),
      publishedAt: nullableTimestamp(raw.publishedAt),
      rejectionReason: nullableReason(raw.rejectionReason),
    };

    assertStateConsistency(row);
    return row;
  });

  return { submissions };
}

export class HttpCreatorContentSubmissionAdapter
implements CreatorContentSubmissionPort {
  constructor(
    private readonly endpoint = "/api/creator/content/submissions",
    private readonly request: SubmissionFetch = (input, init) => fetch(input, init),
  ) {}

  async getSubmissions(): Promise<CreatorContentSubmissionResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorContentSubmissions(await response.json());
    } catch {
      return null;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const STATUS_LABELS: Record<CreatorContentSubmissionStatus, string> = {
  draft: "Entwurf",
  submitted: "Eingereicht",
  approved: "Freigegeben",
  rejected: "Überarbeitung erforderlich",
  published: "Veröffentlicht",
};

function renderUrl(url: string | null): string {
  if (!url) return "<span>Kein Content-Link hinterlegt</span>";
  const safe = escapeHtml(url);
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer">Content öffnen</a>`;
}

export function renderCreatorContentSubmissions(
  response: CreatorContentSubmissionResponse | null,
): string {
  if (!response) {
    return `<section class="creator-content-submissions creator-content-submissions--empty"><span class="eyebrow">CONTENT</span><h2>Status nicht verfügbar</h2><p>Content-Submissions werden erst angezeigt, wenn der serverseitige Creator-Kontext belastbar gelesen werden kann.</p></section>`;
  }

  if (response.submissions.length === 0) {
    return `<section class="creator-content-submissions creator-content-submissions--empty"><span class="eyebrow">CONTENT</span><h2>Noch keine Content-Submissions</h2><p>Sobald Content serverseitig erfasst wurde, erscheint der Review-Status hier.</p></section>`;
  }

  const cards = response.submissions.map((submission) => {
    const reason = submission.rejectionReason
      ? `<div class="creator-content-submissions__reason"><strong>Feedback</strong><p>${escapeHtml(submission.rejectionReason)}</p></div>`
      : "";
    return `<article class="creator-content-submissions__card">
      <div class="creator-content-submissions__card-header">
        <div><span class="eyebrow">${escapeHtml(STATUS_LABELS[submission.status])}</span><h3>${escapeHtml(submission.campaignName)}</h3></div>
        <span class="creator-content-submissions__state">${escapeHtml(STATUS_LABELS[submission.status])}</span>
      </div>
      <div class="creator-content-submissions__link">${renderUrl(submission.contentUrl)}</div>
      ${reason}
      <dl>
        <div><dt>Reviewed</dt><dd>${escapeHtml(submission.reviewedAt ?? "—")}</dd></div>
        <div><dt>Published</dt><dd>${escapeHtml(submission.publishedAt ?? "—")}</dd></div>
      </dl>
    </article>`;
  }).join("");

  return `<section class="creator-content-submissions">
    <div class="creator-content-submissions__header"><div><span class="eyebrow">CONTENT</span><h2>Submission-Status</h2><p>Review- und Publish-Status sind read-only; Mutationen bleiben serverautoritativ.</p></div><span>${response.submissions.length} Submission(s)</span></div>
    <div class="creator-content-submissions__list">${cards}</div>
  </section>`;
}
