import type { CreatorGraph, CreatorProfile } from "./creator";

function nonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must not be empty`);
}

function nonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`);
}

function rate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${field} must be between 0 and 1`);
}

export function validateCreator(creator: CreatorProfile): void {
  nonEmpty(creator.id, "creator.id");
  nonEmpty(creator.handle, "creator.handle");
  if (creator.followers !== null) nonNegative(creator.followers, "creator.followers");
  const p = creator.performance;
  nonNegative(p.gmV30d, "performance.gmV30d");
  nonNegative(p.orders30d, "performance.orders30d");
  nonNegative(p.posts30d, "performance.posts30d");
  nonNegative(p.liveHours30d, "performance.liveHours30d");
  rate(p.conversionRate, "performance.conversionRate");
  rate(p.sampleToPostRate, "performance.sampleToPostRate");
}

export function buildCreatorGraph(graph: CreatorGraph): CreatorGraph {
  const ids = new Set<string>();
  for (const creator of graph.creators) {
    validateCreator(creator);
    if (ids.has(creator.id)) throw new Error(`duplicate creator id: ${creator.id}`);
    ids.add(creator.id);
  }
  for (const edge of [...graph.productEdges, ...graph.brandEdges]) {
    if (!ids.has(edge.creatorId)) throw new Error(`edge references unknown creator: ${edge.creatorId}`);
  }
  return {
    creators: [...graph.creators],
    productEdges: [...graph.productEdges],
    brandEdges: [...graph.brandEdges]
  };
}
