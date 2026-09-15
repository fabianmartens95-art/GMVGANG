import type { CreatorProfile, CreatorBrandEdge, CreatorProductEdge } from "./creator";
import type { CreatorMatchWeights, ProductMatchingProfile } from "./matching-types";
import { anyMatch, overlap } from "./math";
import { scoreCreatorPerformance } from "./performance";
import { brandHistoryScore, productHistoryScore } from "./history";

export function creatorSignals(
  creator: CreatorProfile,
  product: ProductMatchingProfile,
  productEdge?: CreatorProductEdge,
  brandEdge?: CreatorBrandEdge
): Record<keyof CreatorMatchWeights, number> {
  return {
    categoryFit: overlap(product.categories, creator.categories),
    marketFit: anyMatch([product.market], creator.markets),
    languageFit: product.languages.length === 0 ? 100 : anyMatch(product.languages, creator.languages),
    channelFit: product.preferredChannels.length === 0
      ? 100
      : anyMatch(product.preferredChannels, creator.channels),
    performance: scoreCreatorPerformance(creator).score,
    historicProductPerformance: productHistoryScore(productEdge),
    historicBrandPerformance: brandHistoryScore(brandEdge)
  };
}
