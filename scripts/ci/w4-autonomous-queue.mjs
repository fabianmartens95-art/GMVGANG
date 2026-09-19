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

if (!token) fail("github_token_missing");
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) fail("repository_missing");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (!config.enabled) {
  console.log(JSON.stringify({ scope: "gmvgang.w4-autonomous-queue", outcome: "disabled" }, null, 2));
  process.exit(0);
}
if (config.wave !== "W4" || config.trackerIssue !== 301) fail("unexpected_config");

const tracker = await github("/repos/" + repository + "/issues/" + config.trackerIssue);
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
    productionGate: lane.productionGate,
    state: issue.state,
    unchecked: uncheckedCount(body),
    url: issue.html_url
  });
}

const open = states.filter((item) => item.state === "open");
const complete = states.filter((item) => item.state === "closed" && item.unchecked === 0);
const trackerLaneSection = section(tracker.body || "", "Initial lanes");
const trackerUnchecked = uncheckedCount(trackerLaneSection);
const gateReady = complete.length === states.length && trackerUnchecked === 0;

console.log(JSON.stringify({
  scope: "gmvgang.w4-autonomous-queue",
  outcome: gateReady ? "gate_ready" : (open.length < config.minimumActiveWorkstreams ? "needs_replenishment" : "active"),
  minimumActiveWorkstreams: config.minimumActiveWorkstreams,
  active: open.length,
  completed: complete.length,
  total: states.length,
  trackerUnchecked,
  openIssues: open.map((item) => item.issue)
}, null, 2));

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, "gate_ready=" + String(gateReady) + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "open_workstreams=" + String(open.length) + "\n");
  await appendFile(process.env.GITHUB_OUTPUT, "open_issue_numbers=" + open.map((item) => item.issue).join(",") + "\n");
}
