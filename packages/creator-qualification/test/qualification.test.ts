import { describe, expect, it } from "vitest";
import { parseCreatorQualificationInput } from "../src/index.js";

const valid = {
  shopEnabled: "yes",
  shopGmv30dBand: "2500_10000",
  contentFormats: ["shoppable_video", "live_shopping"],
  liveExperience: "experienced",
  liveFrequency: "weekly_2_3",
  liveConcurrentViewers: "25_100",
  productionStyle: "face",
  contentLanguage: "de_en",
  contentCategories: ["beauty", "lifestyle"],
  representativeVideoUrl: "https://www.tiktok.com/@creator/video/123",
  agencyBinding: "none",
  videosPerWeekBand: "weekly_3_5",
  sampleTurnaroundBand: "days_3_5",
  violationStatus: "none",
};

describe("creator qualification input", () => {
  it("accepts a complete R2 payload", () => {
    expect(parseCreatorQualificationInput(valid)).toEqual(valid);
  });

  it("requires live details only when LIVE is selected", () => {
    const missingLive = { ...valid } as Record<string, unknown>;
    delete missingLive.liveExperience;
    expect(parseCreatorQualificationInput(missingLive)).toBeNull();

    const noLive = {
      ...valid,
      contentFormats: ["shoppable_video"],
      liveExperience: undefined,
      liveFrequency: undefined,
      liveConcurrentViewers: undefined,
    };
    const parsed = parseCreatorQualificationInput(noLive);
    expect(parsed?.contentFormats).toEqual(["shoppable_video"]);
    expect(parsed).not.toHaveProperty("liveExperience");
  });

  it("requires GMV only for enabled TikTok Shop", () => {
    expect(parseCreatorQualificationInput({ ...valid, shopGmv30dBand: undefined })).toBeNull();
    expect(parseCreatorQualificationInput({ ...valid, shopEnabled: "no", shopGmv30dBand: undefined })).not.toBeNull();
  });

  it("requires a reason for non-clean violation states", () => {
    expect(parseCreatorQualificationInput({ ...valid, violationStatus: "active" })).toBeNull();
    expect(parseCreatorQualificationInput({ ...valid, violationStatus: "active", violationReason: "Warning is under review." })).not.toBeNull();
  });

  it("limits categories and representative links", () => {
    expect(parseCreatorQualificationInput({ ...valid, contentCategories: ["beauty", "fashion", "food", "tech"] })).toBeNull();
    expect(parseCreatorQualificationInput({ ...valid, representativeVideoUrl: "https://example.com/video" })).toBeNull();
  });
});
