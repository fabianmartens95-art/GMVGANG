import { describe, expect, it } from "vitest";
import { assessCreatorActivation, parseCreatorActivationInput } from "../src/index.js";

const correct = {
  shippingCountry: "Deutschland",
  disclosureAnswer: "use_disclosure",
  healthClaimAnswer: "clarify_before_publish",
  rightsAnswer: "rights_required",
} as const;

describe("creator activation R3", () => {
  it("accepts the complete activation input and passes only at 3/3", () => {
    const parsed = parseCreatorActivationInput(correct);
    expect(parsed).toEqual(correct);
    expect(parsed && assessCreatorActivation(parsed)).toEqual({ complianceScore: 3, compliancePassed: true });
  });

  it("scores wrong compliance answers without marking the activation as passed", () => {
    const parsed = parseCreatorActivationInput({
      ...correct,
      disclosureAnswer: "follower_threshold",
      rightsAnswer: "music_only",
    });
    expect(parsed).not.toBeNull();
    expect(parsed && assessCreatorActivation(parsed)).toEqual({ complianceScore: 1, compliancePassed: false });
  });

  it("rejects missing country and unknown answer values", () => {
    expect(parseCreatorActivationInput({ ...correct, shippingCountry: "" })).toBeNull();
    expect(parseCreatorActivationInput({ ...correct, healthClaimAnswer: "publish_anyway" })).toBeNull();
  });

  it("trims the shipping country", () => {
    expect(parseCreatorActivationInput({ ...correct, shippingCountry: "  Deutschland  " })?.shippingCountry).toBe("Deutschland");
  });
});
