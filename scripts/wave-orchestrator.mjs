import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNotionClient } from "./notion-client.mjs";

const CONFIG_PATH = new URL("../.gmvgang/waves.json", import.meta.url);

export function parseSignalFromIssueBody(body) {
  if (typeof body !== "string") return null;
  const matches = [...body.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  for (const match of matches.reverse()) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object" && parsed.event) return parsed;
    } catch {
      // Fail closed on malformed blocks; continue looking for a valid signal block.
    }
  }
  return null;
}

export function evaluatePreconditions({ control, signal, wave }) {
  const failures = [];
  const gate = control.activeGate ?? {};

  if (control.schemaVersion !== 1) failures.push("unsupported control schema");
  if (control.autoAdvance !== true) failures.push("AUTO_ADVANCE is false");
  if (control.paused === true) failures.push("PAUSED is true");
  if (control.activeWave !== signal.wave) failures.push("signal wave does not match active wave");
  if (wave?.next !== control.nextWave) failures.push("configured next wave does not match control nextWave");
  if (!Array.isArray(control.readyWaves) || !control.readyWaves.includes(control.nextWave)) {
    failures.push("NEXT_WAVE_READY is false");
  }
  if (gate.humanGateRequired === true) failures.push("HUMAN_GATE_REQUIRED is true");
  if (gate.blocked === true) failures.push("active wave is BLOCKED");
  if (Array.isArray(gate.blockingReasons) && gate.blockingReasons.length > 0) {
    failures.push("blocking reasons remain open");
  }
  if (gate.documentationGateComplete !== true) failures.push("Notion Documentation Gate incomplete");
  if (gate.crossProjectLearningComplete !== true) failures.push("Cross-Project Learning Check incomplete");
  if (gate.productionReleaseGateOpen === true) failures.push("Production Release Gate open");

  return { ok: failures.length === 0, failures };
}

export function nextControlState({ control, signal, wave, transitionAt, followingWave }) {
  const completed = new Set(control.completedWaves ?? []);
  completed.add(control.activeWave);

  return {
    ...control,
    activeWave: wave.next,
    nextWave: followingWave?.next ?? null,
    completedWaves: [...completed],
    lastTransitionKey: signal.idempotency_key,
    lastTransitionAt: transitionAt,
    activationPending: wave.next,
    lastSignal: {
      wave: signal.wave,
      gate: signal.gate,
      revision: signal.revision,
      run_id: signal.run_id,
      run_url: signal.run_url
    },
    activeGate: {
      blocked: true,
      blockingReasons: [`Awaiting ${wave.next} exit-gate evidence`],
      documentationGateComplete: false,
      crossProjectLearningComplete: false,
      humanGateRequired: false,
      productionReleaseGateOpen: false
    }
  };
}

export function parseControlBlockText(text, marker) {
  if (!text.startsWith(marker)) throw new Error("control marker missing");
  const json = text.slice(marker.length).trim();
  if (!json) throw new Error("control JSON missing");
  return JSON.parse(json);
}

function serializeControl(marker, control) {
  return `${marker}\n${JSON.stringify(control, null, 2)}`;
}

function richText(block) {
  const value = block?.[block?.type];
  const list = value?.rich_text ?? value?.caption ?? [];
  return Array.isArray(list)
    ? list.map((part) => part?.plain_text ?? part?.text?.content ?? "").join("")
    : "";
}

async function listChildren(notion, blockId) {
  const all = [];
  let startCursor;

  do {
    const page = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {})
    });
    all.push(...(page.results ?? []));
    startCursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (startCursor);

  return all;
}

async function findControlBlock(notion, pageId, marker) {
  const blocks = await listChildren(notion, pageId);
  const matches = blocks.filter((block) => richText(block).includes(marker));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${marker} code block, found ${matches.length}`);
  }
  return matches[0];
}

async function updateControlBlock(notion, blockId, marker, control) {
  await notion.blocks.update({
    block_id: blockId,
    code: {
      rich_text: [
        {
          type: "text",
          text: { content: serializeControl(marker, control) }
        }
      ],
      language: "json"
    }
  });
}

function writeOutputs(values) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(output, `${key}=${String(value)}\n`);
  }
}

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

async function loadControl(notion, config) {
  const block = await findControlBlock(
    notion,
    config.notion.productWavesPageId,
    config.notion.controlMarker
  );
  const control = parseControlBlockText(richText(block), config.notion.controlMarker);
  return { block, control };
}

async function transition() {
  const config = loadConfig();
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required");

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  if (event.action !== "edited" || event.issue?.number !== config.signalIssueNumber) {
    writeOutputs({ transitioned: false, reason: "irrelevant_event" });
    return;
  }
  if (event.repository?.full_name !== config.repository) throw new Error("repository mismatch");

  const signal = parseSignalFromIssueBody(event.issue?.body);
  if (!signal || signal.event !== "wave_gate_passed" || signal.status !== "passed") {
    writeOutputs({ transitioned: false, reason: "no_valid_gate_signal" });
    return;
  }

  const wave = config.waves.find((item) => item.id === signal.wave);
  if (!wave || !wave.next) throw new Error("signal wave has no valid next transition");
  const followingWave = config.waves.find((item) => item.id === wave.next);
  if (!followingWave) throw new Error("next wave missing from transition contract");

  const notion = createNotionClient();
  const { block, control } = await loadControl(notion, config);

  if (control.lastTransitionKey === signal.idempotency_key) {
    writeOutputs({
      transitioned: false,
      reason: "already_applied",
      activation_pending: control.activationPending ?? ""
    });
    return;
  }

  const evaluation = evaluatePreconditions({ control, signal, wave });
  if (!evaluation.ok) {
    console.log(`Auto-advance blocked: ${evaluation.failures.join("; ")}`);
    writeOutputs({ transitioned: false, reason: "preconditions_blocked" });
    return;
  }

  const next = nextControlState({
    control,
    signal,
    wave,
    transitionAt: new Date().toISOString(),
    followingWave
  });

  await updateControlBlock(notion, block.id, config.notion.controlMarker, next);

  writeOutputs({
    transitioned: true,
    completed_wave: signal.wave,
    active_wave: wave.next,
    activation_pending: wave.next,
    activation_title: `${config.activationIssue.titlePrefix} ${followingWave.id} – ${followingWave.name}`
  });
}

async function finalizeActivation() {
  const config = loadConfig();
  const wave = process.env.ACTIVATION_WAVE;
  const issueNumber = Number(process.env.ACTIVATION_ISSUE ?? "");
  if (!wave || !Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new Error("ACTIVATION_WAVE and numeric ACTIVATION_ISSUE are required");
  }

  const notion = createNotionClient();
  const { block, control } = await loadControl(notion, config);
  if (control.activationPending !== wave) {
    throw new Error(`activationPending mismatch: expected ${wave}`);
  }

  await updateControlBlock(notion, block.id, config.notion.controlMarker, {
    ...control,
    activationPending: null,
    lastActivationIssue: issueNumber
  });

  writeOutputs({ finalized: true, activation_issue: issueNumber });
}

async function main() {
  const mode = process.argv[2] ?? "transition";
  if (mode === "transition") return transition();
  if (mode === "finalize") return finalizeActivation();
  throw new Error(`Unknown mode: ${mode}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((error) => {
    console.error(error?.stack ?? String(error));
    process.exitCode = 1;
  });
}
