import { appendFile, readFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
const prNumber = Number(process.env.PR_NUMBER || 0);
const policyPath = process.env.HIGH_VELOCITY_POLICY || ".gmvgang/high-velocity-mode.json";
const lanesPath = ".gmvgang/build-lanes.json";

function fail(reason, detail = {}) {
  console.error(JSON.stringify({ scope: "gmvgang.safe-auto-merge", outcome: "error", reason, ...detail }, null, 2));
  process.exit(1);
}

async function output(key, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${String(value)}\n`);
}

function field(body, name) {
  const escaped = name.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
  return new RegExp("^" + escaped + ":\\s*(.+?)\\s*$", "im").exec(body)?.[1]?.trim() ?? "";
}

async function github(path) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gmvgang-safe-auto-merge"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    fail("github_api_error", { status: response.status, path, body: body.slice(0, 1000) });
  }
  return response.json();
}

async function listPullFiles(number) {
  const all = [];
  let page = 1;
  while (true) {
    const batch = await github(`/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
    page += 1;
  }
}

function isSharedCore(filename, entries) {
  return entries.some((entry) => entry.endsWith("/") ? filename.startsWith(entry) : filename === entry);
}

function newestSuccessfulWorkflow(runs, name) {
  const matching = runs
    .filter((run) => run.name === name)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const latest = matching[0];
  return Boolean(latest && latest.status === "completed" && latest.conclusion === "success");
}

async function ineligible(reason, detail = {}) {
  console.log(JSON.stringify({ scope: "gmvgang.safe-auto-merge", outcome: "ineligible", reason, ...detail }, null, 2));
  await output("eligible", false);
  await output("reason", reason);
  process.exit(0);
}

if (!token) fail("github_token_missing");
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) fail("repository_missing");
if (!Number.isInteger(prNumber) || prNumber <= 0) fail("pr_number_missing");

const policy = JSON.parse(await readFile(policyPath, "utf8"));
const lanes = JSON.parse(await readFile(lanesPath, "utf8"));
if (!policy.enabled || !policy.safeAutoMerge?.enabled) await ineligible("safe_auto_merge_disabled");

const pr = await github(`/repos/${repository}/pulls/${prNumber}`);
if (pr.state !== "open" || pr.merged_at) await ineligible("pr_not_open");
if (pr.draft) await ineligible("draft_pr");
if (!policy.safeAutoMerge.allowedBaseBranches.includes(pr.base?.ref)) {
  await ineligible("base_branch_not_allowed", { base: pr.base?.ref ?? null });
}
if (policy.safeAutoMerge.sameRepositoryOnly && pr.head?.repo?.full_name !== repository) {
  await ineligible("cross_repository_pr_not_allowed", { headRepository: pr.head?.repo?.full_name ?? null });
}

const body = typeof pr.body === "string" ? pr.body : "";
if (field(body, "Auto merge").toLowerCase() !== "yes") await ineligible("explicit_opt_in_missing");
if (field(body, "Production gate").toLowerCase() !== "no") await ineligible("production_gate_required");
if (field(body, "Founder decision").toLowerCase() !== "no") await ineligible("founder_decision_required");
if (field(body, "Contract first").toLowerCase() !== "yes") await ineligible("contract_first_required");

const riskTier = field(body, "Risk tier").toUpperCase();
if (!policy.safeAutoMerge.allowedRiskTiers.includes(riskTier)) {
  await ineligible("risk_tier_not_allowed", { riskTier });
}

const association = String(pr.author_association || "").toUpperCase();
if (!policy.safeAutoMerge.allowedAuthorAssociations.includes(association)) {
  await ineligible("author_association_not_allowed", { association });
}

const files = await listPullFiles(prNumber);
const changedLines = files.reduce((sum, file) => sum + Number(file.changes || 0), 0);
if (files.length > policy.safeAutoMerge.maxChangedFiles) {
  await ineligible("too_many_changed_files", { changedFiles: files.length });
}
if (changedLines > policy.safeAutoMerge.maxChangedLines) {
  await ineligible("too_many_changed_lines", { changedLines });
}

const blocked = files
  .map((file) => file.filename)
  .filter((filename) => policy.safeAutoMerge.blockedPathPrefixes.some((prefix) => filename === prefix || filename.startsWith(prefix)));
if (blocked.length) await ineligible("blocked_path", { blocked });

const shared = files
  .map((file) => file.filename)
  .filter((filename) => isSharedCore(filename, lanes.sharedCore || []));
if (shared.length) await ineligible("shared_core_change", { shared });

const runsResponse = await github(`/repos/${repository}/actions/runs?head_sha=${encodeURIComponent(pr.head.sha)}&event=pull_request&per_page=100`);
const runs = Array.isArray(runsResponse.workflow_runs) ? runsResponse.workflow_runs : [];
const missingGreen = policy.safeAutoMerge.requiredWorkflows.filter((name) => !newestSuccessfulWorkflow(runs, name));
if (missingGreen.length) await ineligible("required_workflows_not_green", { missingGreen });

console.log(JSON.stringify({
  scope: "gmvgang.safe-auto-merge",
  outcome: "eligible",
  pr: prNumber,
  head: pr.head.sha,
  riskTier,
  changedFiles: files.length,
  changedLines,
  requiredWorkflows: policy.safeAutoMerge.requiredWorkflows
}, null, 2));
await output("eligible", true);
await output("reason", "eligible");
