import { appendFileSync, readFileSync } from "node:fs";

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const runId = process.env.GITHUB_RUN_ID || "manual";
const configPath = process.env.WAVE_CONFIG;

if (!repository || !token || !configPath) {
  console.error("integration-wave-v2: GITHUB_REPOSITORY, GITHUB_TOKEN and WAVE_CONFIG are required");
  process.exit(2);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const apiBase = `https://api.github.com/repos/${repository}`;
const allowedAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const blockingLabels = new Set(["queue:hold", "gate:production", "gate:founder", "do-not-merge", "wave:hold"]);

function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

function field(body, name) {
  const wanted = `${name.toLowerCase()}:`;
  const line = String(body || "").split(/\r?\n/).find((value) => value.trim().toLowerCase().startsWith(wanted));
  if (!line) return "";
  return line.trim().slice(line.indexOf(":") + 1).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gmv-integration-wave-v2",
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = { message: raw }; }
  }
  return { ok: response.ok, status: response.status, data };
}

async function checksReady(sha) {
  const checks = await github(`/commits/${sha}/check-runs?per_page=100`);
  if (!checks.ok) throw new Error(`check-runs lookup failed with ${checks.status}`);

  const latest = new Map();
  for (const check of checks.data?.check_runs || []) {
    const previous = latest.get(check.name);
    if (!previous || Number(check.id) > Number(previous.id)) latest.set(check.name, check);
  }

  const baseline = latest.get(config.requiredCheck);
  if (!baseline) return { ok:false, reason:`required check '${config.requiredCheck}' has not started` };
  if (baseline.status !== "completed") return { ok:false, reason:`required check '${config.requiredCheck}' is ${baseline.status}` };
  if (baseline.conclusion !== "success") return { ok:false, reason:`required check '${config.requiredCheck}' concluded ${baseline.conclusion}` };

  return { ok:true, reason:`required check '${config.requiredCheck}' is green` };
}

async function requiredCheckReady(sha) {
  const checks = await github(`/commits/${sha}/check-runs?per_page=100`);
  if (!checks.ok) throw new Error(`check-runs lookup failed with ${checks.status}`);

  const latest = new Map();
  for (const check of checks.data?.check_runs || []) {
    const previous = latest.get(check.name);
    if (!previous || Number(check.id) > Number(previous.id)) latest.set(check.name, check);
  }

  const baseline = latest.get(config.requiredCheck);
  if (!baseline) return { ok:false, state:"missing", reason:`required check '${config.requiredCheck}' has not started` };
  if (baseline.status !== "completed") return { ok:false, state:"pending", reason:`required check '${config.requiredCheck}' is ${baseline.status}` };
  if (baseline.conclusion !== "success") return { ok:false, state:"failed", reason:`required check '${config.requiredCheck}' concluded ${baseline.conclusion}` };
  return { ok:true, state:"success", reason:`required check '${config.requiredCheck}' is green` };
}

function verificationBranchName(wave, kind) {
  return `integration/verify-${kind}-wave-v2-${wave.number}`;
}

async function dispatchVerificationCi(wave, verificationSha, kind) {
  const branch = verificationBranchName(wave, kind);
  const create = await github("/git/refs", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ ref:`refs/heads/${branch}`, sha:verificationSha }),
  });

  if (!create.ok && create.status !== 422) {
    throw new Error(`${kind} verification branch creation failed with ${create.status}`);
  }

  if (!create.ok && create.status === 422) {
    const update = await github(`/git/refs/heads/${branch}`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ sha:verificationSha, force:true }),
    });
    if (!update.ok) throw new Error(`${kind} verification branch update failed with ${update.status}`);
  }

  const dispatched = await github("/actions/workflows/ci.yml/dispatches", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ ref:branch }),
  });
  if (!dispatched.ok) throw new Error(`${kind} verification CI dispatch failed with ${dispatched.status}`);

  summary(`Wave: dispatched ${kind} CI for #${wave.number} on ${verificationSha}.`);
}

async function awaitRequiredCheck(sha, label) {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const check = await requiredCheckReady(sha);
    if (check.ok) {
      summary(`Wave: ${label} required check is green on ${sha}.`);
      return true;
    }
    if (check.state === "failed") {
      summary(`Wave: ${label} verification failed — ${check.reason}.`);
      return false;
    }
    if (attempt === maxAttempts - 1) {
      summary(`Wave: ${label} verification timed out waiting for ${config.requiredCheck}.`);
      return false;
    }
    await sleep(5000);
  }
  return false;
}

async function findPullRequestCiRun(pull) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await github(
      `/actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(pull.head.ref)}&per_page=20`
    );
    if (!response.ok) throw new Error(`pull-request CI lookup failed with ${response.status}`);

    const matches = (response.data?.workflow_runs || [])
      .filter((run) => run.head_sha === pull.head.sha)
      .sort((a, b) => Number(b.id) - Number(a.id));

    if (matches.length) return matches[0];
    await sleep(1000);
  }
  return null;
}

async function approveAndAwaitPullRequestCi(pull) {
  let run = await findPullRequestCiRun(pull);
  if (!run) {
    summary(`Wave: #${pull.number} has no pull-request CI run; fail-closed.`);
    return false;
  }

  if (run.conclusion === "action_required") {
    const approved = await github(`/actions/runs/${run.id}/approve`, { method:"POST" });
    if (!approved.ok) {
      summary(`Wave: could not approve pull-request CI for #${pull.number} (HTTP ${approved.status}).`);
      return false;
    }
    summary(`Wave: approved native pull-request CI run ${run.id} for #${pull.number}.`);
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await github(`/actions/runs/${run.id}`);
    if (!response.ok) throw new Error(`CI run ${run.id} lookup failed with ${response.status}`);
    run = response.data;

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        summary(`Wave: native pull-request CI run ${run.id} is green for #${pull.number}.`);
        return true;
      }
      if (run.conclusion === "action_required") {
        summary(`Wave: native pull-request CI run ${run.id} still requires action after approval.`);
        return false;
      }
      summary(`Wave: native pull-request CI run ${run.id} concluded ${run.conclusion}.`);
      return false;
    }

    if (attempt === 119) {
      summary(`Wave: timed out waiting for native pull-request CI run ${run.id}.`);
      return false;
    }
    await sleep(5000);
  }

  return false;
}

async function reviewsReady(number) {
  const reviews = await github(`/pulls/${number}/reviews?per_page=100`);
  if (!reviews.ok) throw new Error(`reviews lookup for #${number} failed with ${reviews.status}`);
  const latest = new Map();