import { readFileSync } from "node:fs";

const eventPath = process.env.GITHUB_EVENT_PATH;
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!eventPath || !repository || !token) {
  console.error("dependency-gate: event path, repository, and token are required");
  process.exit(2);
}

const event = JSON.parse(readFileSync(eventPath, "utf8"));
const body = typeof event.pull_request?.body === "string" ? event.pull_request.body : "";
const line = /^Depends on:\s*(.+)$/im.exec(body)?.[1]?.trim() ?? "";
const dependencies = [...new Set([...line.matchAll(/#(\d+)/g)].map((match) => Number(match[1])))];

if (!dependencies.length) {
  console.log(JSON.stringify({ scope: "gmvgang.dependency-gate", dependencies: [] }, null, 2));
  process.exit(0);
}

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gmvgang-dependency-gate",
    },
  });
  return response;
}

const states = [];
const blockers = [];

for (const number of dependencies) {
  const pull = await github(`/pulls/${number}`);
  if (pull.ok) {
    const data = await pull.json();
    const satisfied = Boolean(data.merged_at);
    states.push({ number, type: "pull_request", state: data.state, merged: satisfied });
    if (!satisfied) blockers.push(`#${number} is a pull request and is not merged`);
    continue;
  }

  if (pull.status !== 404) {
    console.error(`dependency-gate: failed reading PR #${number}: ${pull.status}`);
    process.exit(2);
  }

  const issue = await github(`/issues/${number}`);
  if (!issue.ok) {
    blockers.push(`#${number} does not resolve to an accessible issue or pull request`);
    continue;
  }
  const data = await issue.json();
  const satisfied = data.state === "closed";
  states.push({ number, type: "issue", state: data.state, closed: satisfied });
  if (!satisfied) blockers.push(`#${number} is an issue and is not closed`);
}

console.log(JSON.stringify({ scope: "gmvgang.dependency-gate", dependencies: states }, null, 2));

if (blockers.length) {
  console.error("dependency-gate blocked:");
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exit(1);
}