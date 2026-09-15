import type { CreatorBrandEdge, CreatorProductEdge, CreatorProfile } from "./creator";
import type { CreatorMatchComponent, CreatorMatchResult, CreatorMatchWeights, ProductMatchingProfile } from "./matching-types";
import { normalize, round } from "./math";
import { creatorSignals } from "./signals";

export function scoreCreatorMatch(
  creator: CreatorProfile,
  product: ProductMatchingProfile,
  weights: CreatorMatchWeights,
  productEdge?: CreatorProductEdge,
  brandEdge?: CreatorBrandEdge
): CreatorMatchResult {
  const scores = creatorSignals(creator, product, productEdge, brandEdge);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const components = (Object.keys(weights) as Array<keyof CreatorMatchWeights>).map((id) => ({
    id,
    score: round(scores[id]),
    weight: round(weights[id]),
    weightedContribution: round(scores[id] * weights[id] / total)
  } satisfies CreatorMatchComponent));
  const rejectionReasons: string[] = [];
  if (product.excludedCreatorIds.includes(creator.id)) rejectionReasons.push("excluded");
  if (!creator.markets.map(normalize).includes(normalize(product.market))) rejectionReasons.push("market");
  const reasons = components.filter((item) => item.score >= 70).map((item) => item.id);
  return {
    creatorId: creator.id,
    handle: creator.handle,
    score: round(components.reduce((sum, item) => sum + item.weightedContribution, 0)),
    eligible: rejectionReasons.length === 0,
    rejectionReasons,
    reasons,
    components
  };
}
