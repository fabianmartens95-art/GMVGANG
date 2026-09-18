import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePreconditions,
  nextControlState,
  parseControlBlockText,
  parseSignalFromIssueBody
} from "./wave-orchestrator.mjs";

const signal = {
  event: "wave_gate_passed",
  wave: "W3",
  gate: "production-security",
  status: "passed",
  revision: "abc",
  run_id: "123",
  run_url: "https://github.com/example/repo/actions/runs/123",
  idempotency_key: "W3:production-security:abc:123:1"
};

const wave = { id: "W3", name: "Production Security", next: "W4" };
const followingWave = { id: "W4", name: "Campaign Core", next: "W5" };

function readyControl() {
  return {
    schemaVersion: 1,
    autoAdvance: true,
    paused: false,
    activeWave: "W3",
    nextWave: "W4",
    readyWaves: ["W4", "W5", "W6", "W7"],
    completedWaves: [],
    lastTransitionKey: null,
    activeGate: {
      blocked: false,
      blockingReasons: [],
      documentationGateComplete: true,
      crossProjectLearningComplete: true,
      humanGateRequired: false,
      productionReleaseGateOpen: false
    }
  };
}

test("parses the latest valid JSON signal block", () => {
  const body = [
    "text",
    "```json",
    JSON.stringify({ event: "old" }),
    "```",
    "```json",
    JSON.stringify(signal),
    "```"
  ].join("\n");

  assert.deepEqual(parseSignalFromIssueBody(body), signal);
});

test("fails closed while a production release gate is open", () => {
  const control = readyControl();
  control.activeGate.productionReleaseGateOpen = true;

  const result = evaluatePreconditions({ control, signal, wave });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("Production Release Gate open"));
});

test("requires the next wave to be explicitly ready", () => {
  const control = readyControl();
  control.readyWaves = [];

  const result = evaluatePreconditions({ control, signal, wave });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("NEXT_WAVE_READY is false"));
});

test("allows a fully green transition", () => {
  const result = evaluatePreconditions({ control: readyControl(), signal, wave });
  assert.deepEqual(result, { ok: true, failures: [] });
});

test("advances state and creates a blocked evidence gate for the new active wave", () => {
  const next = nextControlState({
    control: readyControl(),
    signal,
    wave,
    transitionAt: "2026-09-19T00:00:00.000Z",
    followingWave
  });

  assert.equal(next.activeWave, "W4");
  assert.equal(next.nextWave, "W5");
  assert.deepEqual(next.completedWaves, ["W3"]);
  assert.equal(next.activationPending, "W4");
  assert.equal(next.activeGate.blocked, true);
  assert.equal(next.lastTransitionKey, signal.idempotency_key);
});

test("parses the machine control marker", () => {
  const marker = "GMVGANG_WAVE_CONTROL_V1";
  const control = readyControl();
  const parsed = parseControlBlockText(`${marker}\n${JSON.stringify(control)}`, marker);
  assert.equal(parsed.activeWave, "W3");
});
