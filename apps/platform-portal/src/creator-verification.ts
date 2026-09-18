export type CreatorVerificationStatus =
  | "unverified"
  | "pending_review"
  | "verified"
  | "rejected";

export type CreatorVerificationBadge =
  | "none"
  | "pending"
  | "verified"
  | "not_verified";

export type CreatorVerificationNextAction =
  | "request_review"
  | "wait_for_review"
  | "none";

export type CreatorVerificationPublicView = {
  status: CreatorVerificationStatus;
  badge: CreatorVerificationBadge;
  nextAction: CreatorVerificationNextAction;
};

export type CreatorVerificationResponse = {
  verification: CreatorVerificationPublicView;
};

export interface CreatorVerificationPort {
  getVerification(): Promise<CreatorVerificationResponse | null>;
}

type VerificationFetch = (
  input: string,
  init: {
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const EXPECTED: Record<CreatorVerificationStatus, {
  badge: CreatorVerificationBadge;
  nextAction: CreatorVerificationNextAction;
}> = {
  unverified: { badge: "none", nextAction: "request_review" },
  pending_review: { badge: "pending", nextAction: "wait_for_review" },
  verified: { badge: "verified", nextAction: "none" },
  rejected: { badge: "not_verified", nextAction: "request_review" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

export function parseCreatorVerification(
  payload: unknown,
): CreatorVerificationResponse {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["verification"]) ||
    !isRecord(payload.verification) ||
    !hasOnlyKeys(payload.verification, ["status", "badge", "nextAction"])
  ) {
    throw new Error("CREATOR_VERIFICATION_PAYLOAD_INVALID");
  }

  const { status, badge, nextAction } = payload.verification;
  if (typeof status !== "string" || !(status in EXPECTED)) {
    throw new Error("CREATOR_VERIFICATION_STATE_INVALID");
  }

  const expected = EXPECTED[status as CreatorVerificationStatus];
  if (badge !== expected.badge || nextAction !== expected.nextAction) {
    throw new Error("CREATOR_VERIFICATION_STATE_INCONSISTENT");
  }

  return {
    verification: {
      status: status as CreatorVerificationStatus,
      badge: expected.badge,
      nextAction: expected.nextAction,
    },
  };
}

export class HttpCreatorVerificationAdapter implements CreatorVerificationPort {
  constructor(
    private readonly endpoint = "/api/creator/verification",
    private readonly request: VerificationFetch = (input, init) => fetch(input, init),
  ) {}

  async getVerification(): Promise<CreatorVerificationResponse | null> {
    try {
      const response = await this.request(this.endpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      return parseCreatorVerification(await response.json());
    } catch {
      return null;
    }
  }
}

const PRESENTATION: Record<CreatorVerificationStatus, {
  title: string;
  detail: string;
  stateLabel: string;
}> = {
  unverified: {
    title: "Verifizierung noch nicht angefordert",
    detail: "Dein öffentlicher Creator-Status ist noch nicht verifiziert.",
    stateLabel: "Nicht verifiziert",
  },
  pending_review: {
    title: "Verifizierung wird geprüft",
    detail: "Deine Anfrage befindet sich in der Prüfung. Interne Prüfdaten werden hier nicht angezeigt.",
    stateLabel: "In Prüfung",
  },
  verified: {
    title: "Creator verifiziert",
    detail: "Dein öffentlicher Creator-Status ist als verifiziert bestätigt.",
    stateLabel: "Verifiziert",
  },
  rejected: {
    title: "Aktuell nicht verifiziert",
    detail: "Der öffentliche Status bleibt nicht verifiziert. Interne Entscheidungsdetails werden hier nicht angezeigt.",
    stateLabel: "Nicht verifiziert",
  },
};

export function renderCreatorVerification(
  response: CreatorVerificationResponse | null,
): string {
  if (!response) {
    return `<section class="creator-verification creator-verification--empty"><span class="eyebrow">VERIFICATION</span><h2>Status nicht verfügbar</h2><p>Der Verifizierungsstatus wird erst angezeigt, wenn er serverseitig sicher gelesen werden kann.</p></section>`;
  }

  const verification = response.verification;
  const copy = PRESENTATION[verification.status];
  const nextCopy = verification.nextAction === "request_review"
    ? "Nächster Schritt: Prüfung über den vorgesehenen Verifizierungs-Workflow anfordern."
    : verification.nextAction === "wait_for_review"
      ? "Nächster Schritt: Prüfung abwarten."
      : "Kein Verifizierungsschritt erforderlich.";

  return `<section class="creator-verification creator-verification--${verification.status}">
    <div class="creator-verification__header">
      <div><span class="eyebrow">VERIFICATION</span><h2>${copy.title}</h2></div>
      <span class="creator-verification__badge creator-verification__badge--${verification.badge}">${copy.stateLabel}</span>
    </div>
    <p>${copy.detail}</p>
    <p class="creator-verification__next">${nextCopy}</p>
  </section>`;
}
