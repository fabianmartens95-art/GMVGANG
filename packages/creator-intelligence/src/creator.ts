export type CreatorChannel = "video" | "live";

export type CreatorPerformance = {
  gmV30d: number;
  orders30d: number;
  conversionRate: number;
  posts30d: number;
  liveHours30d: number;
  sampleToPostRate: number;
  lastActiveAt: string | null;
};

export type CreatorProfile = {
  id: string;
  handle: string;
  markets: string[];
  languages: string[];
  categories: string[];
  channels: CreatorChannel[];
  followers: number | null;
  performance: CreatorPerformance;
};

export type CreatorProductEdge = {
  creatorId: string;
  productId: string;
  brandId: string;
  gmV: number;
  orders: number;
  posts: number;
  conversionRate: number;
  lastActivityAt: string | null;
};

export type CreatorBrandEdge = {
  creatorId: string;
  brandId: string;
  collaborations: number;
  gmV: number;
  lastActivityAt: string | null;
};

export type CreatorGraph = {
  creators: CreatorProfile[];
  productEdges: CreatorProductEdge[];
  brandEdges: CreatorBrandEdge[];
};
