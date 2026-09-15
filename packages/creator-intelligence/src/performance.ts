import type { CreatorProfile } from "./creator";
import { conversionScore, gmvScore, recencyScore, round } from "./math";
import { validateCreator } from "./validate";

export type CreatorPerformanceScore = {
  score: number;
  components: {
    gmV: number;
    conversionRate: number;
    activity: number;
    sampleReliability: number;
  };
};

export function scoreCreatorPerformance(creator: CreatorProfile): CreatorPerformanceScore {
  validateCreator(creator);
  const p = creator.performance;
  const components = {
    gmV: gmvScore(p.gmV30d),
    conversionRate: conversionScore(p.conversionRate),
    activity: Math.min(100,
      recencyScore(p.lastActiveAt) * 0.55 +
      Math.min(p.posts30d / 12, 1) * 30 +
      Math.min(p.liveHours30d / 20, 1) * 15
    ),
    sampleReliability: p.sampleToPostRate * 100
  };
  const score = components.gmV * 0.4 + components.conversionRate * 0.25 +
    components.activity * 0.2 + components.sampleReliability * 0.15;
  return {
    score: round(score),
    components: {
      gmV: round(components.gmV),
      conversionRate: round(components.conversionRate),
      activity: round(components.activity),
      sampleReliability: round(components.sampleReliability)
    }
  };
}
