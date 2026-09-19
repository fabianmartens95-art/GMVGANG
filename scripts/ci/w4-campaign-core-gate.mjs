// Governance-only W4 exit gate; Production release remains a separate control path.
import { readFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN?.trim();
const notionToken = process.env.NOTION_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
const revision = process.env.GATE_REVISION?.trim();
const configPath = process.env.W4_AUTONOMOUS_CONFIG || ".gmvgang/w4-autonomous-execution.json";

function fail(reason, detail = {}) {
  console.error(JSON.stringify({ scope: "gmvgang.w4-campaign-core-gate", outcome: "blocked", reason, ...detail }, null, 2));
  process.exit(1);
}

function section(markdown, heading) {
  const marker = "## " + heading;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const rest = markdown.slice(start + marker.length);
  const next = rest.search(/\n##\s+/);
  return next < 0 ? rest : rest.slice(0, next);
}

function uncheckedCount(markdown) {
  return (markdown.match(/^- \[ \]/gm) || []).length;
}

async function github(path, init = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    fail("github_api_error", { status: response.status, path, body: body.slice(0, 1000) });
  }
  return response.status === 204 ? null : response.json();
}

async function notion(path, init = {}) {
  const response = await fetch("https://api.notion.com/v1" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + notionToken,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    fail("notion_api_error", { status: response.status, path, body: body.slice(0, 1000) });
  }
  return response.status === 204 ? null : response.json();
}

async function listChildren(blockId) {
  const all = [];
  let cursor;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data = await notion("/blocks/" + blockId + "/children?" + qs);
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

async function findControlBlock(rootId, marker, depth = 0) {
  if (depth > 6) return null;
  const children = await listChildren(rootId);
  for (const block of children) {
    if (block.type === "code" && plainText(block).includes(marker)) return block;
    if (block.has_children) {
      const nested = await findControlBlock(block.id, marker, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

if (!token) fail("github_token_missing");
if (!notionToken) fail("notion_token_missing");
if (!repository) fail("repository_missing");
if (!revision || !/^[0-9a-f]{40}$/i.test(revision)) fail("invalid_revision");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (!config.enabled || config.wave !== "W4" || config.trackerIssue !== 301) fail("unexpected_config");
if (config.safety?.productionPromotionAllowed !== false) fail("production_boundary_not_fail_closed");

const main = await github("/repos/" + repository + "/branches/main");
if (main.commit?.sha !== revision) fail("revision_not_current_main", { currentMain: main.commit?.sha, revision });

const tracker = await github("/repos/" + repository + "/issues/" + config.trackerIssue);
if (tracker.state !== "open") fail("tracker_not_open");
const trackerInitial = section(tracker.body || "", "Initial lanes");
if (!trackerInitial || uncheckedCount(trackerInitial) > 0) fail("tracker_lanes_incomplete", { unchecked: uncheckedCount(trackerInitial) });

const laneEvidence = [];
for (const lane of config.lanes) {
  const issue = await github("/repos/" + repository + "/issues/" + lane.issue);
  const body = typeof issue.body === "string" ? issue.body : "";
  const unchecked = uncheckedCount(body);
  laneEvidence.push({ issue: lane.issue, state: issue.state, unchecked });
  if (issue.state !== "closed" || unchecked > 0) fail("lane_not_complete", { issue: lane.issue, state: issue.state, unchecked });
}

const notionPageId = "3df76c68-17ac-81a9-9c24-c670195871d6";
const marker = "GMVGANG_WAVE_CONTROL_V1";
const controlBlock = await findControlBlock(notionPageId, marker);
if (!controlBlock) fail("control_block_not_found");
let control;
try { control = JSON.parse(plainText(controlBlock)); } catch (error) { fail("control_block_invalid_json", { message: error.message }); }

if (control.marker !== marker) fail("control_marker_mismatch");
if (control.auto_advance !== true) fail("auto_advance_disabled");
if (control.current_wave !== "W4" || control.next_wave !== "W5") fail("unexpected_wave_state", { current: control.current_wave, next: control.next_wave });
if (control.blocked || control.paused || control.human_gate_required || control.production_release_gate_open) {
  fail("control_gate_open", { blocked: control.blocked, paused: control.paused, human: control.human_gate_required, production: control.production_release_gate_open });
}

const updated = {
  ...control,
  current_wave_state: "Exit Gate Review",
  next_wave_ready: true,
  exit_gate_status: "ready",
  documentation_gate: "complete",
  cross_project_learning: "complete",
  blocked: false,
  blocker_reason: null,
  w4_gate_revision: revision,
  w4_gate_prepared_at: new Date().toISOString()
};

await notion("/blocks/" + controlBlock.id, {
  method: "PATCH",
  body: JSON.stringify({ code: { rich_text: [{ type: "text", text: { content: JSON.stringify(updated) } }], language: "json" } })
});

await github("/repos/" + repository + "/issues/" + config.trackerIssue, {
  method: "PATCH",
  body: JSON.stringify({ state: "closed", state_reason: "completed" })
});

console.log(JSON.stringify({
  scope: "gmvgang.w4-campaign-core-gate",
  outcome: "ready",
  revision,
  tracker: config.trackerIssue,
  lanes: laneEvidence,
  productionPromotion: false
}, null, 2));
