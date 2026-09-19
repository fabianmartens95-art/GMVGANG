import { appendFile, readFile } from "node:fs/promises";

const configPath = process.env.W4_AUTONOMOUS_CONFIG || ".gmvgang/w4-autonomous-execution.json";
const token = process.env.GITHUB_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();

function fail(reason, detail = {}) {
  console.error(JSON.stringify({ scope: "gmvgang.w4-autonomous-queue", outcome: "error", reason, ...detail }, null, 2));
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

function hoursSince(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return null;
  return Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10;
}

function isBlocked(markdown) {
  return /\bBLOCKED BY\b|^Status:\s*.*\bBLOCKED\b/im.test(markdown);
}

async function github(path, init = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    fail("github_api_error", { status: response.status, path, body: body.slice(0, 1000) });
  }
  return response.status === 204 ? null : response.json();
}

async function writeSummary(data) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = data.open.map((item) =>
    `| #${item.issue} | ${item.key} | ${item.lane} | ${item.blocked ? "blocked" : "active"} | ${item.ageHours ?? "n/a"}h |`
  );
  const markdown = [
    "# W4 High Velocity Queue",
    "",
    `- Outcome: **${data.outcome}**`,
    `- Exact main: \`${data.mainSha}\``,
    `- Active workstreams: **${data.open.length}**`,
    `- Recommended parallelism: **${data.recommendedParallelism}**`,
    `- Completed lanes: **${data.completeCount}/${data.total}**`,
    `- Blocked issues: **${data.blockedIssues.length ? data.blockedIssues.map((n) => "#" + n).join(", ") : "none"}**`,
    `- Gate ready: **${data.gateReady}**`,
    "",
    "| Issue | Slice | Lane | State | Age |",
    "| --- | --- | --- | --- | ---: |",
    ...(rows.length ? rows : ["| — | — | — | — | — |"]),
    "",
    "Production promotion remains separately controlled."
  ].join("\n");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}

if (!token) fail("github_token_missing");
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) fail("repository_missing");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (!config.enabled) {
  console.log(JSON.stringify({ scope: "gmvgang.w4-autonomous-queue", outcome: "disabled" }, null, 2));
  process.exit(0);
}
if (config.wave !== "W4" || config.trackerIssue !== 301) fail("unexpected_config");

const velocityPath = config.velocityPolicy || ".gmvgang/high-velocity-mode.json";
const velocity = JSON.parse(await readFile(velocityPath, "utf8"));
if (!velocity.enabled || velocity.mode !== "high_velocity_v2") fail("velocity_policy_invalid");

const [tracker, main] = await Promise.all([
  github("/repos/" + repository + "/issues/" + config.trackerIssue),
  github("/repos/" + repository + "/branches/main")
]);
if (tracker.state !== "open") {
  console.log(JSON.stringify({ scope: "gmvgang.w4-autonomous-queue", outcome: "tracker_closed", tracker: config.trackerIssue }, null, 2));
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "gate_ready=false\n");
  process.exit(0);
}

const states = [];
for (const lane of config.lanes) {
  const issue = await github("/repos/" + repository + "/issues/" + lane.issue);
  const body = typeof issue.body === "string" ? issue.body : "";
  states.push({
    key: lane.key,
    issue: lane.issue,
    lane: lane.lane,
    priority: lane.priority,
    productionGate: lane.productionGate,
    state: issue.state,
    unchecked: uncheckedCount(body),
    blocked: issue.state === "open" && isBlocked(body),
    ageHours: issue.state === "open" ? hoursSince(issue.created_at) : null,
    updatedHours: hoursSince(issue.updated_at),
    url: issue.html_url
  });
}

const open = states.filter((item) => item.state === "open");
const complete = states.filter((item) => item.state === "closed" && item.unchecked === 0);
const blockedIssues = open.filter((item) => item.blocked).map((item) => item.issue);
const trackerLaneSection = section(tracker.body || "", "Initial lanes");
const trackerUnchecked = uncheckedCount(trackerLaneSection);
const gateReady = complete.length === states.length && trackerUnchecked === 0;
const preferredMax = Math.min(
  Number(config.maximumActiveWorkstreams || 9),
  Number(velocity.parallelism?.preferredMaximumActiveWorkstreams || 9)
);
const recommendedParallelism = Math.min(preferredMax, open.length);
const outcome = gateReady
  ? "gate_ready"
  : open.length < config.minimumActiveWorkstreams
    ? "active_below_target"
    : "active";

const summary = {
  scope: "gmvgang.w4-autonomous-queue",
  outcome,
  mode: velocity.mode,
  mainSha: main.commit?.sha ?? null,
  minimumActiveWorkstreams: config.minimumActiveWorkstreams,
  preferredMaximumActiveWorkstreams: preferredMax,
  recommendedParallelism,
  active: open.length,
  completed: complete.length,
  total: states.length,
  blockedIssues,
  trackerUnchecked,
  openIssues: open.map((item) => item.issue),
  telemetry: velocity.telemetry?.metrics ?? []
};

console.log(JSON.stringify(summary, null, 2));
await writeSummary({
  outcome,
  mainSha: summary.mainSha,
  recommendedParallelism,
  open,
  completeCount: complete.length,
  total: states.length,
  blockedIssues,
  gateReady
});

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, "gate_ready=" + String(gateReady) + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "open_workstreams=" + String(open.length) + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "open_issue_numbers=" + open.map((item) => item.issue).join(",") + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "blocked_issue_numbers=" + blockedIssues.join(",") + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "recommended_parallelism=" + String(recommendedParallelism) + "\n");
}
