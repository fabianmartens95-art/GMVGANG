import type { CreatorBrandEdge, CreatorProductEdge } from "./creator";
import { conversionScore, gmvScore, recencyScore } from "./math";

export function productHistoryScore(edge?: CreatorProductEdge): number {
  if (!edge) return 0;
  return Math.min(100,
    gmvScore(edge.gmV) * 0.55 +
    conversionScore(edge.conversionRate) * 0.25 +
    Math.min(edge.posts / 8, 1) * 10 +
    recencyScore(edge.lastActivityAt) * 0.1
  );
}

export function brandHistoryScore(edge?: CreatorBrandEdge): number {
  if (!edge) return 0;
  return Math.min(100,
    gmvScore(edge.gmV) * 0.65 +
    Math.min(edge.collaborations / 4, 1) * 20 +
    recencyScore(edge.lastActivityAt) * 0.15
  );
}
