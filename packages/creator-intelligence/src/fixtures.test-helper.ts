import type { CreatorGraph } from "./creator";
import type { ProductMatchingProfile } from "./matching-types";

const now = new Date().toISOString();

export const graph: CreatorGraph = {
  creators: [
    { id: "beauty", handle: "beauty_creator", markets: ["DE"], languages: ["de"], categories: ["beauty"], channels: ["video"], followers: 18000,
      performance: { gmV30d: 5000, orders30d: 120, conversionRate: 0.06, posts30d: 10, liveHours30d: 0, sampleToPostRate: 0.9, lastActiveAt: now } },
    { id: "gaming", handle: "gaming_creator", markets: ["DE"], languages: ["de"], categories: ["gaming"], channels: ["video"], followers: 400000,
      performance: { gmV30d: 10000, orders30d: 180, conversionRate: 0.05, posts30d: 12, liveHours30d: 0, sampleToPostRate: 0.8, lastActiveAt: now } }
  ],
  productEdges: [
    { creatorId: "beauty", productId: "p1", brandId: "b1", gmV: 8000, orders: 150, posts: 6, conversionRate: 0.07, lastActivityAt: now }
  ],
  brandEdges: [
    { creatorId: "beauty", brandId: "b1", collaborations: 3, gmV: 12000, lastActivityAt: now }
  ]
};

export const product: ProductMatchingProfile = {
  id: "p1", brandId: "b1", market: "DE", languages: ["de"], categories: ["beauty"],
  preferredChannels: ["video"], excludedCreatorIds: []
};
