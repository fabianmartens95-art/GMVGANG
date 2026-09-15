import type { CreatorMatchResult, MatchCreatorsInput } from "./matching-types";
import { buildCreatorGraph } from "./validate";
import { resolveMatchWeights } from "./weights";
import { scoreCreatorMatch } from "./score-match";

export function matchCreators(input: MatchCreatorsInput): CreatorMatchResult[] {
  const graph = buildCreatorGraph(input.graph);
  if (!input.product.id.trim() || !input.product.brandId.trim() || !input.product.market.trim()) {
    throw new Error("product id, brand and market are required");
  }
  if (input.product.categories.length === 0) throw new Error("product category is required");
  const weights = resolveMatchWeights(input.weights);
  const results = graph.creators.map((creator) => {
    const productEdge = graph.productEdges.find((edge) =>
      edge.creatorId === creator.id && edge.productId === input.product.id
    );
    const brandEdge = graph.brandEdges.find((edge) =>
      edge.creatorId === creator.id && edge.brandId === input.product.brandId
    );
    return scoreCreatorMatch(creator, input.product, weights, productEdge, brandEdge);
  });
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.creatorId.localeCompare(b.creatorId);
  });
  if (input.limit === undefined) return results;
  if (!Number.isInteger(input.limit) || input.limit <= 0) throw new Error("limit must be a positive integer");
  return results.slice(0, input.limit);
}
