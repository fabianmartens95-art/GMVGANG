export type BrandCreatorVisibility = "hidden" | "eligible" | "discoverable";

export type CreatorBrandVisibilityGovernanceInput = {
  current: BrandCreatorVisibility;
  target: BrandCreatorVisibility;
  creatorOptedIn: boolean;
  actorCanManageCreators: boolean;
};

export type CreatorBrandVisibilityGovernanceDecision =
  | { ok: true }
  | {
      ok: false;
      error:
        | "CREATOR_DISCOVERY_MANAGEMENT_DENIED"
        | "CREATOR_DISCOVERY_OPT_IN_REQUIRED"
        | "CREATOR_DISCOVERY_INVALID_TRANSITION";
    };

export function authorizeCreatorBrandVisibilityTransition(
  input: CreatorBrandVisibilityGovernanceInput,
): CreatorBrandVisibilityGovernanceDecision {
  if (!input.actorCanManageCreators) {
    return { ok: false, error: "CREATOR_DISCOVERY_MANAGEMENT_DENIED" };
  }

  if (input.current === input.target) return { ok: true };

  if (input.target === "discoverable" && !input.creatorOptedIn) {
    return { ok: false, error: "CREATOR_DISCOVERY_OPT_IN_REQUIRED" };
  }

  const allowed: Record<BrandCreatorVisibility, readonly BrandCreatorVisibility[]> = {
    hidden: ["eligible"],
    eligible: ["hidden", "discoverable"],
    discoverable: ["eligible", "hidden"],
  };

  return allowed[input.current].includes(input.target)
    ? { ok: true }
    : { ok: false, error: "CREATOR_DISCOVERY_INVALID_TRANSITION" };
}

export type BrandCreatorCandidate = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  market: string;
  language: string;
  niches: string[];
  visibility: BrandCreatorVisibility;
  performance?: {
    gmV?: number;
    orders?: number;
    postedContent?: number;
    updatedAt?: string | null;
  };
};

export type BrandCreatorDiscoveryFilters = {
  query?: string;
  market?: string;
  language?: string;
  niches?: string[];
  minimumOrders?: number;
  minimumGmv?: number;
};

export type BrandCreatorDiscoveryItem = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  market: string;
  language: string;
  niches: string[];
  matchScore: number;
  matchReasons: string[];
  performance: {
    gmV: number | null;
    orders: number | null;
    postedContent: number | null;
    updatedAt: string | null;
  };
};

export type BrandCreatorDiscoveryReadModel = {
  filters: BrandCreatorDiscoveryFilters;
  totalEligible: number;
  totalMatches: number;
  creators: BrandCreatorDiscoveryItem[];
};

function clean(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function cleanList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map(clean).filter(Boolean))];
}

function finiteNonNegative(value: number | undefined, code: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function normalizedFilters(filters: BrandCreatorDiscoveryFilters): BrandCreatorDiscoveryFilters {
  const query = filters.query?.trim();
  const market = filters.market?.trim();
  const language = filters.language?.trim();
  const niches = (filters.niches ?? []).reduce<string[]>((result, item) => {
    const value = item.trim();
    if (!value) return result;
    if (!result.some((existing) => clean(existing) === clean(value))) result.push(value);
    return result;
  }, []);
  const minimumOrders = finiteNonNegative(filters.minimumOrders, "CREATOR_DISCOVERY_MINIMUM_ORDERS_INVALID");
  const minimumGmv = finiteNonNegative(filters.minimumGmv, "CREATOR_DISCOVERY_MINIMUM_GMV_INVALID");

  return {
    ...(query ? { query } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(niches.length ? { niches } : {}),
    ...(minimumOrders !== undefined ? { minimumOrders } : {}),
    ...(minimumGmv !== undefined ? { minimumGmv } : {}),
  };
}

function candidateMatches(
  candidate: BrandCreatorCandidate,
  filters: BrandCreatorDiscoveryFilters,
): boolean {
  if (candidate.visibility !== "discoverable") return false;

  const query = clean(filters.query);
  if (query) {
    const haystack = [
      candidate.displayName,
      candidate.tiktokHandle,
      candidate.market,
      candidate.language,
      ...candidate.niches,
    ].map(clean);
    if (!haystack.some((value) => value.includes(query))) return false;
  }

  if (filters.market && clean(candidate.market) !== clean(filters.market)) return false;
  if (filters.language && clean(candidate.language) !== clean(filters.language)) return false;

  const requiredNiches = cleanList(filters.niches);
  if (requiredNiches.length) {
    const candidateNiches = new Set(cleanList(candidate.niches));
    if (!requiredNiches.some((niche) => candidateNiches.has(niche))) return false;
  }

  if (
    filters.minimumOrders !== undefined &&
    (candidate.performance?.orders ?? 0) < filters.minimumOrders
  ) return false;

  if (
    filters.minimumGmv !== undefined &&
    (candidate.performance?.gmV ?? 0) < filters.minimumGmv
  ) return false;

  return true;
}

function scoreCandidate(
  candidate: BrandCreatorCandidate,
  filters: BrandCreatorDiscoveryFilters,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const requestedNiches = cleanList(filters.niches);
  const candidateNiches = new Set(cleanList(candidate.niches));
  const matchingNiches = requestedNiches.filter((niche) => candidateNiches.has(niche));
  if (matchingNiches.length) {
    score += Math.min(40, matchingNiches.length * 20);
    reasons.push(`${matchingNiches.length} Nischen-Match${matchingNiches.length === 1 ? "" : "es"}`);
  }

  if (filters.market && clean(candidate.market) === clean(filters.market)) {
    score += 20;
    reasons.push("Markt passt");
  }

  if (filters.language && clean(candidate.language) === clean(filters.language)) {
    score += 15;
    reasons.push("Sprache passt");
  }

  const query = clean(filters.query);
  if (query) {
    if (clean(candidate.tiktokHandle).includes(query)) {
      score += 15;
      reasons.push("Handle passt zur Suche");
    } else if (clean(candidate.displayName).includes(query)) {
      score += 10;
      reasons.push("Name passt zur Suche");
    }
  }

  if ((candidate.performance?.orders ?? 0) > 0) {
    score += 5;
    reasons.push("Bestellungen vorhanden");
  }

  if ((candidate.performance?.postedContent ?? 0) > 0) {
    score += 5;
    reasons.push("Content-Historie vorhanden");
  }

  return { score: Math.min(100, score), reasons };
}

export function buildBrandCreatorDiscoveryReadModel(
  candidates: readonly BrandCreatorCandidate[],
  rawFilters: BrandCreatorDiscoveryFilters = {},
): BrandCreatorDiscoveryReadModel {
  const filters = normalizedFilters(rawFilters);
  const discoverable = candidates.filter((candidate) => candidate.visibility === "discoverable");

  const creators = discoverable
    .filter((candidate) => candidateMatches(candidate, filters))
    .map((candidate): BrandCreatorDiscoveryItem => {
      const match = scoreCandidate(candidate, filters);
      return {
        creatorProfileId: candidate.creatorProfileId,
        displayName: candidate.displayName.trim(),
        tiktokHandle: candidate.tiktokHandle.trim(),
        market: candidate.market.trim(),
        language: candidate.language.trim(),
        niches: [...new Set(candidate.niches.map((item) => item.trim()).filter(Boolean))],
        matchScore: match.score,
        matchReasons: match.reasons,
        performance: {
          gmV: candidate.performance?.gmV ?? null,
          orders: candidate.performance?.orders ?? null,
          postedContent: candidate.performance?.postedContent ?? null,
          updatedAt: candidate.performance?.updatedAt ?? null,
        },
      };
    })
    .sort((left, right) =>
      right.matchScore - left.matchScore ||
      (right.performance.orders ?? -1) - (left.performance.orders ?? -1) ||
      left.tiktokHandle.localeCompare(right.tiktokHandle)
    );

  return {
    filters,
    totalEligible: discoverable.length,
    totalMatches: creators.length,
    creators,
  };
}

export type CreatorDiscoveryReviewCandidate = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  visibility: BrandCreatorVisibility;
  creatorOptedIn: boolean;
  updatedAt: string;
};

export type CreatorDiscoveryReviewState =
  | "needs_eligibility_review"
  | "waiting_creator_opt_in"
  | "ready_for_staff_approval"
  | "already_discoverable";

export type CreatorDiscoveryReviewItem = {
  creatorProfileId: string;
  displayName: string;
  tiktokHandle: string;
  visibility: BrandCreatorVisibility;
  state: CreatorDiscoveryReviewState;
  nextAction:
    | "review_eligibility"
    | "wait_for_creator_opt_in"
    | "approve_discoverability"
    | "none";
  updatedAt: string;
};

function reviewState(candidate: CreatorDiscoveryReviewCandidate): CreatorDiscoveryReviewItem {
  if (candidate.visibility === "discoverable") {
    return {
      ...candidate,
      state: "already_discoverable",
      nextAction: "none",
    };
  }

  if (candidate.visibility === "hidden") {
    return {
      ...candidate,
      state: "needs_eligibility_review",
      nextAction: "review_eligibility",
    };
  }

  if (!candidate.creatorOptedIn) {
    return {
      ...candidate,
      state: "waiting_creator_opt_in",
      nextAction: "wait_for_creator_opt_in",
    };
  }

  return {
    ...candidate,
    state: "ready_for_staff_approval",
    nextAction: "approve_discoverability",
  };
}

const REVIEW_PRIORITY: Record<CreatorDiscoveryReviewState, number> = {
  ready_for_staff_approval: 0,
  needs_eligibility_review: 1,
  waiting_creator_opt_in: 2,
  already_discoverable: 3,
};

export function buildCreatorDiscoveryReviewQueue(
  candidates: readonly CreatorDiscoveryReviewCandidate[],
  options: { includeDiscoverable?: boolean } = {},
): CreatorDiscoveryReviewItem[] {
  return candidates
    .map(reviewState)
    .filter((item) => options.includeDiscoverable || item.state !== "already_discoverable")
    .sort((left, right) =>
      REVIEW_PRIORITY[left.state] - REVIEW_PRIORITY[right.state] ||
      Date.parse(left.updatedAt) - Date.parse(right.updatedAt) ||
      left.tiktokHandle.localeCompare(right.tiktokHandle)
    );
}
