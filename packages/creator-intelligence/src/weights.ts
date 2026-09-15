import type { CreatorMatchWeights } from "./matching-types";

export const defaultMatchWeights: CreatorMatchWeights = {
  categoryFit: 0.22,
  marketFit: 0.16,
  languageFit: 0.08,
  channelFit: 0.08,
  performance: 0.2,
  historicProductPerformance: 0.16,
  historicBrandPerformance: 0.1
};

export function resolveMatchWeights(
  overrides?: Partial<CreatorMatchWeights>
): CreatorMatchWeights {
  const weights = { ...defaultMatchWeights, ...overrides };
  for (const [key, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`matchWeights.${key} must be greater than 0`);
    }
  }
  return weights;
}
