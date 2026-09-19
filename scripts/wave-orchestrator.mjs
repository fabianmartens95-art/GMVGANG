import { readFile } from "node:fs/promises";

const configPath = process.env.WAVE_CONFIG_PATH || ".gmvgang/waves.json";
const notionToken = process.env.NOTION_TOKEN?.trim();
const eventWave = process.env.EVENT_WAVE?.trim();
const eventGate = process.env.EVENT_GATE?.trim();
const eventStatus = process.env.EVENT_STATUS?.trim();
const eventRevision = process.env.EVENT_REVISION?.trim();
const eventRunId = process.env.EVENT_RUN_ID?.trim();
const eventRunUrl = process.env.EVENT_RUN_URL?.trim();
const mode = (process.env.ORCHESTRATOR_MODE || "apply").trim();
const githubEventName = process.env.GITHUB_EVENT_NAME?.trim();

function stop(reason, detail = {}) {
  console.log(JSON.stringify({ scope: "gmvgang.wave-orchestrator", outcome: "blocked", reason, ...detail }, null, 2));
  process.exit(0);
}

function fail(reason, detail = {}) {
  console.error(JSON.stringify({ scope: "gmvgang.wave-orchestrator", outcome: "error", reason, ...detail }, null, 2));
  process.exit(1);
}

async function notion(path, init = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    fail("notion_api_error", { status: response.status, body: text.slice(0, 1000) });
  }

  return response.status === 204 ? null : response.json();
}

async function listChildren(blockId) {
  const all = [];
  let cursor;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data = await notion(`/blocks/${blockId}/children?${qs}`);
    all.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return all;
}

function plainText(block) {
  const payload = block[block.type];
  const rich = payload?.rich_text || [];
  return rich.map((part) => part.plain_text || part.text?.content || "").join("");
}

async function findBlockRecursive(rootId, predicate, depth = 0) {
  if (depth > 6) return null;
  const children = await listChildren(rootId);
  for (const block of children) {
    if (predicate(block)) return block;
    if (block.has_children) {
      const nested = await findBlockRecursive(block.id, predicate, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

async function patchRichTextBlock(block, text, extra = {}) {
  const type = block.type;
  const body = {
    [type]: {
      rich_text: [{ type: "text", text: { content: text } }],
      ...extra
    }
  };
  await notion(`/blocks/${block.id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

const config = JSON.parse(await readFile(configPath, "utf8"));

if (githubEventName === "workflow_dispatch" && mode !== "dry-run") {
  stop("manual_apply_forbidden");
}
const wave = config.waves[eventWave];

if (!eventWave || !wave) stop("unknown_or_missing_wave", { eventWave });
if (eventStatus !== "passed") stop("gate_not_passed", { eventStatus });
if (eventGate !== wave.requiredGate) stop("unexpected_gate", { expected: wave.requiredGate, actual: eventGate });
if (!eventRevision || !/^[0-9a-f]{7,40}$/i.test(eventRevision)) stop("invalid_revision");
if (!eventRunId || !/^\d+$/.test(eventRunId)) stop("invalid_run_id");
if (!eventRunUrl || !eventRunUrl.startsWith("https://github.com/fabianmartens95-art/GMVGANG/actions/runs/")) {
  stop("invalid_run_url");
}
if (!wave.next) stop("final_wave_has_no_successor", { wave: eventWave });
if (!notionToken) stop("notion_token_missing");

const controlBlock = await findBlockRecursive(
  config.notion.productWavesPageId,
  (block) => block.type === "code" && plainText(block).includes(config.notion.controlMarker)
);
if (!controlBlock) fail("control_block_not_found");

let control;
try {
  control = JSON.parse(plainText(controlBlock));
} catch (error) {
  fail("control_block_invalid_json", { message: error.message });
}

if (control.marker !== config.notion.controlMarker) fail("control_marker_mismatch");
if (control.current_wave !== eventWave) stop("stale_wave_event", { controlWave: control.current_wave, eventWave });
if (control.next_wave !== wave.next) stop("unexpected_next_wave", { controlNext: control.next_wave, expectedNext: wave.next });

for (const [key, expected] of Object.entries(config.requiredControlState)) {
  if (control[key] !== expected) {
    stop("control_precondition_failed", { key, expected, actual: control[key] });
  }
}

const transitionKey = `${eventWave}->${wave.next}:${eventRevision}:${eventRunId}`;
if (control.last_transition_key === transitionKey) {
  stop("duplicate_transition", { transitionKey });
}

const nextWave = config.waves[wave.next];
const nextNext = nextWave?.next || null;
const updatedControl = {
  ...control,
  current_wave: wave.next,
  current_wave_state: "Active",
  next_wave: nextNext,
  next_wave_ready: false,
  exit_gate_status: "pending",
  documentation_gate: "pending",
  cross_project_learning: "pending",
  human_gate_required: false,
  production_release_gate_open: false,
  paused: false,
  blocked: false,
  blocker_reason: null,
  last_completed_wave: eventWave,
  last_transition_key: transitionKey,
  last_transition_revision: eventRevision,
  last_transition_run_id: eventRunId,
  last_transition_run_url: eventRunUrl,
  last_transition_at: new Date().toISOString()
};

if (mode === "dry-run") {
  console.log(JSON.stringify({
    scope: "gmvgang.wave-orchestrator",
    outcome: "dry_run_passed",
    transitionKey,
    from: eventWave,
    to: wave.next,
    control: updatedControl
  }, null, 2));
  process.exit(0);
}

await patchRichTextBlock(controlBlock, JSON.stringify(updatedControl), { language: "json" });

const statusBlock = await findBlockRecursive(
  config.notion.productWavesPageId,
  (block) => plainText(block).startsWith("ACTIVE: ")
);
if (statusBlock) {
  await patchRichTextBlock(
    statusBlock,
    `ACTIVE: ${wave.next} – ${nextWave.name}. ${eventWave} – ${wave.name} completed through verified gate evidence. Subsequent waves remain gated by their predecessor Exit Gates.`
  );
}

const ceoStatusBlock = await findBlockRecursive(
  config.notion.ceoControlCenterPageId,
  (block) => block.type === "callout" && plainText(block).startsWith("ACTIVE: ")
);
if (ceoStatusBlock) {
  await patchRichTextBlock(
    ceoStatusBlock,
    `ACTIVE: ${wave.next} – ${nextWave.name}. Auto-advanced from ${eventWave} after verified gate evidence. Production releases remain separately controlled.`,
    { color: "green_bg", icon: { type: "emoji", emoji: "🟢" } }
  );
}

console.log(JSON.stringify({
  scope: "gmvgang.wave-orchestrator",
  outcome: "advanced",
  transitionKey,
  from: eventWave,
  to: wave.next,
  revision: eventRevision,
  runId: eventRunId,
  runUrl: eventRunUrl
}, null, 2));
