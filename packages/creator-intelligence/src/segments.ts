import type { CreatorChannel, CreatorProfile } from "./creator";
import type { CreatorOperationsSnapshot } from "./operations";
import { scoreCreatorPerformance } from "./performance";

export type CreatorSegmentDefinition = {
  id: string;
  name: string;
  eligibleOnly?: boolean;
  marketsAny?: string[];
  languagesAny?: string[];
  categoriesAny?: string[];
  channelsAny?: CreatorChannel[];
  tiersAny?: string[];
  lifecycleStatusesAny?: string[];
  intakeStagesAny?: string[];
  shopExperienceAny?: string[];
  liveExperienceAny?: string[];
  complianceRiskAny?: string[];
  minFollowers?: number;
  minPerformanceScore?: number;
};

export type CreatorSegmentMember = {
  creatorId: string;
  handle: string;
  performanceScore: number;
  followers: number | null;
  reasons: string[];
};

export type CreatorList = {
  id: string;
  name: string;
  sourceSegmentId: string;
  creatorIds: string[];
  generatedAt: string;
};

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function overlaps(expected: string[] | undefined, actual: string[]): boolean {
  if (!expected || expected.length === 0) return true;
  const set = new Set(actual.map(normalized));
  return expected.some((value) => set.has(normalized(value)));
}

function equalsAny(expected: string[] | undefined, actual: string | null): boolean {
  if (!expected || expected.length === 0) return true;
  if (!actual) return false;
  const current = normalized(actual);
  return expected.some((value) => normalized(value) === current);
}

function matchReason(label: string, values: string[] | undefined): string | null {
  return values && values.length > 0 ? `${label}:${values.join("|")}` : null;
}

export function segmentCreators(
  creators: CreatorProfile[],
  operations: CreatorOperationsSnapshot[],
  segment: CreatorSegmentDefinition
): CreatorSegmentMember[] {
  const operationsByCreator = new Map(operations.map((snapshot) => [snapshot.creatorId, snapshot]));
  const members: CreatorSegmentMember[] = [];

  for (const creator of creators) {
    const operation = operationsByCreator.get(creator.id);
    const performanceScore = scoreCreatorPerformance(creator).score;

    if (segment.eligibleOnly === true && operation?.eligibleForMatching !== true) continue;
    if (!overlaps(segment.marketsAny, creator.markets)) continue;
    if (!overlaps(segment.languagesAny, creator.languages)) continue;
    if (!overlaps(segment.categoriesAny, creator.categories)) continue;
    if (!overlaps(segment.channelsAny, creator.channels)) continue;
    if (!equalsAny(segment.tiersAny, operation?.tier ?? null)) continue;
    if (!equalsAny(segment.lifecycleStatusesAny, operation?.lifecycleStatus ?? null)) continue;
    if (!equalsAny(segment.intakeStagesAny, operation?.intakeStage ?? null)) continue;
    if (!equalsAny(segment.shopExperienceAny, operation?.shopExperience ?? null)) continue;
    if (!equalsAny(segment.liveExperienceAny, operation?.liveExperience ?? null)) continue;
    if (!equalsAny(segment.complianceRiskAny, operation?.complianceRisk ?? null)) continue;
    if (segment.minFollowers !== undefined && (creator.followers ?? 0) < segment.minFollowers) continue;
    if (segment.minPerformanceScore !== undefined && performanceScore < segment.minPerformanceScore) continue;

    const reasons = [
      matchReason("market", segment.marketsAny),
      matchReason("language", segment.languagesAny),
      matchReason("category", segment.categoriesAny),
      matchReason("channel", segment.channelsAny),
      matchReason("tier", segment.tiersAny),
      matchReason("status", segment.lifecycleStatusesAny),
      matchReason("intake", segment.intakeStagesAny)
    ].filter((reason): reason is string => reason !== null);

    if (segment.eligibleOnly === true) reasons.push("eligible");
    if (segment.minFollowers !== undefined) reasons.push(`followers>=${segment.minFollowers}`);
    if (segment.minPerformanceScore !== undefined) reasons.push(`performance>=${segment.minPerformanceScore}`);

    members.push({
      creatorId: creator.id,
      handle: creator.handle,
      performanceScore,
      followers: creator.followers,
      reasons
    });
  }

  return members.sort((a, b) =>
    b.performanceScore - a.performanceScore ||
    (b.followers ?? 0) - (a.followers ?? 0) ||
    a.handle.localeCompare(b.handle)
  );
}

export function materializeCreatorList(
  id: string,
  name: string,
  segment: CreatorSegmentDefinition,
  creators: CreatorProfile[],
  operations: CreatorOperationsSnapshot[],
  generatedAt: string
): CreatorList {
  if (!id.trim()) throw new Error("creator list id must not be empty");
  if (!name.trim()) throw new Error("creator list name must not be empty");
  if (!generatedAt.trim()) throw new Error("generatedAt must not be empty");

  return {
    id,
    name,
    sourceSegmentId: segment.id,
    creatorIds: segmentCreators(creators, operations, segment).map((member) => member.creatorId),
    generatedAt
  };
}
