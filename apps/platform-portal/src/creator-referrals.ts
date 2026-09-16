const REFERRAL_STATUSES = [
  "attributed",
  "profile_complete",
  "qualified",
  "contracted",
  "active",
  "performing",
  "rejected",
  "fraud_review",
] as const;

type ReferralStatus = typeof REFERRAL_STATUSES[number];

export type CreatorReferralHubItem = {
  status: ReferralStatus;
  attributedAt: string;
  qualifiedAt?: string;
  contractedAt?: string;
  activatedAt?: string;
  performingAt?: string;
};

export type CreatorReferralHubModel = {
  referralCode: string;
  totalReferrals: number;
  statusCounts: Record<ReferralStatus, number>;
  recentReferrals: CreatorReferralHubItem[];
};

export type CreatorReferralHubResult =
  | { ok: true; model: CreatorReferralHubModel }
  | { ok: false; error: string };

type ReferralHubHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type CreatorReferralHubFetch = (
  input: string,
  init: {
    method: "GET";
    credentials: "include";
    cache: "no-store";
    headers: Record<string, string>;
  },
) => Promise<ReferralHubHttpResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validStatus(value: unknown): value is ReferralStatus {
  return typeof value === "string" && (REFERRAL_STATUSES as readonly string[]).includes(value);
}

function parseOptionalDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!validDate(value)) throw new Error("CREATOR_REFERRAL_HUB_INVALID");
  return value;
}

export function parseCreatorReferralHub(payload: unknown): CreatorReferralHubResult {
  if (!isRecord(payload)) throw new Error("CREATOR_REFERRAL_HUB_INVALID");
  if (payload.source !== "production" || !isRecord(payload.model)) throw new Error("CREATOR_REFERRAL_HUB_INVALID");
  const model = payload.model;
  if (
    typeof model.referralCode !== "string" || !model.referralCode.trim() ||
    typeof model.totalReferrals !== "number" || !Number.isInteger(model.totalReferrals) || model.totalReferrals < 0 ||
    !isRecord(model.statusCounts) || !Array.isArray(model.recentReferrals)
  ) throw new Error("CREATOR_REFERRAL_HUB_INVALID");

  const statusCounts = {} as Record<ReferralStatus, number>;
  for (const status of REFERRAL_STATUSES) {
    const count = model.statusCounts[status];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      throw new Error("CREATOR_REFERRAL_HUB_INVALID");
    }
    statusCounts[status] = count;
  }
  const counted = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  if (counted !== model.totalReferrals) throw new Error("CREATOR_REFERRAL_HUB_INVALID");

  const recentReferrals = model.recentReferrals.map((value) => {
    if (!isRecord(value) || !validStatus(value.status) || !validDate(value.attributedAt)) {
      throw new Error("CREATOR_REFERRAL_HUB_INVALID");
    }
    const qualifiedAt = parseOptionalDate(value.qualifiedAt);
    const contractedAt = parseOptionalDate(value.contractedAt);
    const activatedAt = parseOptionalDate(value.activatedAt);
    const performingAt = parseOptionalDate(value.performingAt);
    return {
      status: value.status,
      attributedAt: value.attributedAt,
      ...(qualifiedAt ? { qualifiedAt } : {}),
      ...(contractedAt ? { contractedAt } : {}),
      ...(activatedAt ? { activatedAt } : {}),
      ...(performingAt ? { performingAt } : {}),
    };
  });
  if (recentReferrals.length > 20 || recentReferrals.length > model.totalReferrals) {
    throw new Error("CREATOR_REFERRAL_HUB_INVALID");
  }

  return {
    ok: true,
    model: {
      referralCode: model.referralCode.trim(),
      totalReferrals: model.totalReferrals,
      statusCounts,
      recentReferrals,
    },
  };
}

export class HttpCreatorReferralHubAdapter {
  constructor(
    private readonly endpoint = "/api/creator/referrals",
    private readonly fetchHub: CreatorReferralHubFetch = (input, init) => fetch(input, init),
  ) {}

  async getHub(): Promise<CreatorReferralHubResult> {
    try {
      const response = await this.fetchHub(this.endpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) {
        const error = isRecord(payload) && typeof payload.error === "string" ? payload.error : "creator_referrals_unavailable";
        return { ok: false, error };
      }
      return parseCreatorReferralHub(payload);
    } catch {
      return { ok: false, error: "creator_referrals_unavailable" };
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

function statusLabel(status: ReferralStatus): string {
  const labels: Record<ReferralStatus, string> = {
    attributed: "Registriert",
    profile_complete: "Profil vollständig",
    qualified: "Qualifiziert",
    contracted: "Vertrag",
    active: "Aktiv",
    performing: "Performing",
    rejected: "Nicht qualifiziert",
    fraud_review: "Prüfung",
  };
  return labels[status];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function referralError(error: string): string {
  if (error === "creator_profile_not_found") return "Lege zuerst dein Creator-Profil an, um deinen persönlichen Referral-Link zu erhalten.";
  if (error === "creator_referrals_access_denied") return "Dieser Account hat keinen Zugriff auf Creator Referrals.";
  return "Dein Referral Hub konnte gerade nicht geladen werden.";
}

export function renderCreatorReferralHub(result: CreatorReferralHubResult, origin: string): string {
  if (!result.ok) {
    return `<section class="creator-referral-empty">
      <div class="eyebrow">REFERRAL HUB</div>
      <h2>Referral Hub nicht verfügbar</h2>
      <p>${escapeHtml(referralError(result.error))}</p>
      ${result.error === "creator_profile_not_found" ? '<a href="/join" data-nav class="creator-referral-button">Creator-Profil anlegen</a>' : ""}
    </section>`;
  }

  const model = result.model;
  const shareUrl = `${origin.replace(/\/$/, "")}/join?ref=${encodeURIComponent(model.referralCode)}`;
  const qualifiedPlus = model.statusCounts.qualified + model.statusCounts.contracted + model.statusCounts.active + model.statusCounts.performing;
  const activePlus = model.statusCounts.active + model.statusCounts.performing;
  const reviewOrRejected = model.statusCounts.fraud_review + model.statusCounts.rejected;

  return `<section class="creator-referral-shell">
    <div class="creator-referral-hero">
      <div>
        <div class="eyebrow">CREATOR → CREATOR</div>
        <h2>Dein persönlicher Referral-Link</h2>
        <p>Neue Creator können sich offen registrieren. Eine Empfehlung wird erst über qualifizierte Meilensteine wertvoll – nicht durch einen bloßen Klick oder eine Registrierung.</p>
      </div>
      <div class="creator-referral-code"><span>CODE</span><strong>${escapeHtml(model.referralCode)}</strong></div>
    </div>

    <div class="creator-referral-share">
      <input id="creator-referral-link" readonly value="${escapeHtml(shareUrl)}" aria-label="Persönlicher Referral-Link" />
      <button id="creator-referral-copy" class="creator-referral-button" type="button">Link kopieren</button>
      <button id="creator-referral-share" class="creator-referral-button creator-referral-button--secondary" type="button">Teilen</button>
      <span id="creator-referral-feedback" aria-live="polite"></span>
    </div>

    <div class="creator-referral-stats">
      <article><span>Empfehlungen</span><strong>${model.totalReferrals}</strong><small>eindeutig attribuiert</small></article>
      <article><span>Qualifiziert+</span><strong>${qualifiedPlus}</strong><small>qualified bis performing</small></article>
      <article><span>Aktiv+</span><strong>${activePlus}</strong><small>active oder performing</small></article>
      <article><span>Review / Rejected</span><strong>${reviewOrRejected}</strong><small>keine automatische Belohnung</small></article>
    </div>

    <div class="creator-referral-grid">
      <section class="creator-referral-panel">
        <div class="creator-referral-panel__header"><h3>Milestones</h3><span>${model.totalReferrals} total</span></div>
        <div class="creator-referral-milestones">
          ${REFERRAL_STATUSES.map((status) => `<div><span>${escapeHtml(statusLabel(status))}</span><strong>${model.statusCounts[status]}</strong></div>`).join("")}
        </div>
      </section>

      <section class="creator-referral-panel">
        <div class="creator-referral-panel__header"><h3>Letzte Empfehlungen</h3><span>anonymisiert</span></div>
        ${model.recentReferrals.length
          ? `<ol class="creator-referral-list">${model.recentReferrals.map((item, index) => `<li><span>#${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(statusLabel(item.status))}</strong><time datetime="${escapeHtml(item.attributedAt)}">${escapeHtml(formatDate(item.attributedAt))}</time></li>`).join("")}</ol>`
          : '<p class="creator-referral-muted">Noch keine Referral-Attribution vorhanden.</p>'}
      </section>
    </div>

    <aside class="creator-referral-boundary">
      <strong>Reward Engine noch nicht aktiviert.</strong>
      <span>Der Hub zeigt Attribution und qualifizierte Meilensteine. Reward-Beträge, Freigaben und Auszahlungen werden erst über eine separate, fraud-geschützte Aktivierungsschicht eingeführt.</span>
    </aside>
  </section>`;
}

async function copyReferralLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

export function wireCreatorReferralHub(): void {
  const input = document.querySelector<HTMLInputElement>("#creator-referral-link");
  const copyButton = document.querySelector<HTMLButtonElement>("#creator-referral-copy");
  const shareButton = document.querySelector<HTMLButtonElement>("#creator-referral-share");
  const feedback = document.querySelector<HTMLElement>("#creator-referral-feedback");
  if (!input) return;

  copyButton?.addEventListener("click", async () => {
    const copied = await copyReferralLink(input.value);
    if (feedback) feedback.textContent = copied ? "Link kopiert." : "Kopieren nicht verfügbar.";
  });

  shareButton?.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "GMVGANG Creator Network", text: "Bewirb dich als Creator bei GMVGANG.", url: input.value });
        if (feedback) feedback.textContent = "Share-Menü geöffnet.";
        return;
      } catch {
        // User cancellation or unavailable target falls back to copying.
      }
    }
    const copied = await copyReferralLink(input.value);
    if (feedback) feedback.textContent = copied ? "Link kopiert." : "Teilen nicht verfügbar.";
  });
}
