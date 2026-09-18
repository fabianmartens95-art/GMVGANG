import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(".gmvgang/build-lanes.json", "utf8"));
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repository || !token) {
  console.error("active-lanes: GITHUB_REPOSITORY and GITHUB_TOKEN are required");
  process.exit(2);
}

const response = await fetch(`https://api.github.com/repos/${repository}/pulls?state=open&per_page=100`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gmvgang-parallel-build-guard",
  },
});

if (!response.ok) {
  console.error(`active-lanes: GitHub API failed with ${response.status}`);
  process.exit(2);
}

const pulls = await response.json();
const contracted = [];
const legacy = [];

for (const pull of pulls) {
  const body = typeof pull.body === "string" ? pull.body : "";
  const lane = /^Lane:\s*(foundation|creator|brand|commerce|web|devops|integration)\s*$/im.exec(body)?.[1];
  if (!lane) {
    legacy.push(pull.number);
    continue;
  }
  contracted.push({ number: pull.number, lane, draft: Boolean(pull.draft) });
}

const activeLanes = [...new Set(contracted.map((pull) => pull.lane))].sort();
const developmentLanes = activeLanes.filter((lane) => lane !== "integration");

console.log(JSON.stringify({
  scope: "gmvgang.active-lanes",
  minimumActiveWorkstreams: config.minimumActiveWorkstreams,
  maximumDevelopmentLanes: config.maxActiveLanes,
  activeLanes,
  developmentLanes,
  contractedPullRequests: contracted,
  ignoredLegacyPullRequests: legacy,
}, null, 2));

if (!Number.isInteger(config.minimumActiveWorkstreams) || config.minimumActiveWorkstreams < 5) {
  console.error("active-lanes: minimumActiveWorkstreams must be at least 5");
  process.exit(1);
}

const knownDevelopmentLaneCount = Object.keys(config.lanes ?? {}).length;
if (
  !Number.isInteger(config.maxActiveLanes)
  || config.maxActiveLanes < knownDevelopmentLaneCount
) {
  console.error(
    `active-lanes: maxActiveLanes must not impose a lower cap than the ${knownDevelopmentLaneCount} configured development lanes`,
  );
  process.exit(1);
}

if (developmentLanes.length > knownDevelopmentLaneCount) {
  console.error(
    `active-lanes: detected ${developmentLanes.length} development lanes but only ${knownDevelopmentLaneCount} are configured`,
  );
  process.exit(1);
}