import { describe, expect, it } from "vitest";
import { graph } from "./fixtures.test-helper";
import type { CreatorOperationsSnapshot } from "./operations";
import { materializeCreatorList, segmentCreators } from "./segments";

const operations: CreatorOperationsSnapshot[] = [
  {
    creatorId: "beauty",
    source: "notion",
    sourceRecordId: "beauty",
    lifecycleStatus: "Aktiv",
    intakeStage: "Aktiv",
    tier: "Core",
    profileUrl: null,
    accountRegion: "Deutschland",
    audienceRegion: "DACH",
    shopExperience: "Erfahren",
    liveExperience: "Basis",
    shopGmvBand30d: "2.500–10.000 €",
    averageViewsLast10: 10000,
    screeningScore: 85,
    videoCapacity: "3–5",
    liveAvailability: "1× pro Woche",
    complianceRisk: "Niedrig",
    legalHold: false,
    eligibleForMatching: true,
    exclusionReasons: []
  },
  {
    creatorId: "gaming",
    source: "notion",
    sourceRecordId: "gaming",
    lifecycleStatus: "Aktiv",
    intakeStage: "Aktiv",
    tier: "Growth",
    profileUrl: null,
    accountRegion: "Deutschland",
    audienceRegion: "DACH",
    shopExperience: "Profi",
    liveExperience: "Erfahren",
    shopGmvBand30d: "10.000 €+",
    averageViewsLast10: 150000,
    screeningScore: 90,
    videoCapacity: "6+",
    liveAvailability: "2–3× pro Woche",
    complianceRisk: "Niedrig",
    legalHold: true,
    eligibleForMatching: false,
    exclusionReasons: ["legal-hold"]
  }
];

const beautySegment = {
  id: "active-beauty-de",
  name: "Active Beauty DE",
  eligibleOnly: true,
  marketsAny: ["DE"],
  categoriesAny: ["beauty"],
  channelsAny: ["video"] as const,
  lifecycleStatusesAny: ["Aktiv"],
  minFollowers: 10000
};

describe("creator segments", () => {
  it("selects creators from reusable operational and intelligence criteria", () => {
    const members = segmentCreators(graph.creators, operations, beautySegment);

    expect(members).toHaveLength(1);
    expect(members[0]?.creatorId).toBe("beauty");
    expect(members[0]?.reasons).toContain("eligible");
    expect(members[0]?.reasons).toContain("category:beauty");
    expect(members[0]?.performanceScore).toBeGreaterThan(0);
  });

  it("does not include operationally excluded creators when eligibleOnly is enabled", () => {
    const members = segmentCreators(graph.creators, operations, {
      id: "all-de",
      name: "All eligible DE creators",
      eligibleOnly: true,
      marketsAny: ["DE"]
    });

    expect(members.map((member) => member.creatorId)).toEqual(["beauty"]);
  });

  it("materializes a deterministic list from a segment", () => {
    const list = materializeCreatorList(
      "list-1",
      "Beauty shortlist",
      beautySegment,
      graph.creators,
      operations,
      "2026-09-15T12:00:00.000Z"
    );

    expect(list).toEqual({
      id: "list-1",
      name: "Beauty shortlist",
      sourceSegmentId: "active-beauty-de",
      creatorIds: ["beauty"],
      generatedAt: "2026-09-15T12:00:00.000Z"
    });
  });
});
