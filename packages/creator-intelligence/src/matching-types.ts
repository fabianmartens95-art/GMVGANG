import type { CreatorChannel, CreatorGraph } from "./creator";

export type ProductMatchingProfile = {
  id: string;
  brandId: string;
  market: string;
  languages: string[];
  categories: string[];
  preferredChannels: CreatorChannel[];
  excludedCreatorIds: string[];
};

export type CreatorMatchWeights = {
  categoryFit: number;
  marketFit: number;
  languageFit: number;
  channelFit: number;
  performance: number;
  historicProductPerformance: number;
  historicBrandPerformance: number;
};

export type CreatorMatchComponent = {
  id: keyof CreatorMatchWeights;
  score: number;
  weight: number;
  weightedContribution: number;
};

export type CreatorMatchResult = {
  creatorId: string;
  handle: string;
  score: number;
  eligible: boolean;
  rejectionReasons: string[];
  reasons: string[];
  components: CreatorMatchComponent[];
};

export type MatchCreatorsInput = {
  graph: CreatorGraph;
  product: ProductMatchingProfile;
  weights?: Partial<CreatorMatchWeights>;
  limit?: number;
};
