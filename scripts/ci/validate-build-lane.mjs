import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evaluateDependabotPolicy } from "./dependabot-policy.mjs";

const config = JSON.parse(readFileSync(".gmvgang/build-lanes.json", "utf8"));
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
const branch = process.env.HEAD_REF ?? "";
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!base || !head || !eventPath) {
  console.error("parallel-build-guard: BASE_SHA, HEAD_SHA, and GITHUB_EVENT_PATH are required");
  process.exit(2);
}

const event = JSON.parse(readFileSync(eventPath, "utf8"));
const pullRequest = event.pull_request;
const body = typeof pullRequest?.body === "string" ? pullRequest.body : "";

const changed = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const explicitLane = /^Lane:\s*(foundation|creator|brand|commerce|web|devops|integration)\s*$/im.exec(body)?.[1] ?? null;
const dependabotPolicy = evaluateDependabotPolicy(pullRequest, changed);

if (dependabotPolicy.isDependabot && !dependabotPolicy.supportedEcosystem) {
  console.error("parallel-build-guard: unsupported Dependabot ecosystem; policy update required before merge.");
  process.exit(1);
}

if (dependabotPolicy.isDependabot && !dependabotPolicy.safeFiles) {
  console.error(
    `parallel-build-guard: Dependabot changed files outside its approved dependency surface: ${dependabotPolicy.unsafeFiles.join(", ") || "none"}.`,
  );
  process.exit(1);
}

const declaredLane = explicitLane ?? (dependabotPolicy.autoContractEligible ? "devops" : null);

if (!declaredLane) {
  if (dependabotPolicy.isDependabot) {
    console.error(
      `parallel-build-guard: Dependabot PR is not eligible for an implicit devops lane (${dependabotPolicy.reason}); declare a normal Build contract for reviewed exceptions.`,
    );
  } else {
    console.error("parallel-build-guard: PR must declare a valid Lane before ownership can be checked.");
  }
  process.exit(1);
}

const integrationBranch = config.integrationBranchPrefixes.some((prefix) => branch.startsWith(prefix));
const matches = new Set();
const ownedFiles = new Map();

for (const file of changed) {
  for (const [lane, value] of Object.entries(config.lanes)) {
    if (value.owns.some((prefix) => file.startsWith(prefix))) {
      matches.add(lane);
      const list = ownedFiles.get(lane) ?? [];
      list.push(file);
      ownedFiles.set(lane, list);
    }
  }
}

const touchesSharedCore = changed.some((file) =>
  config.sharedCore.some((entry) => entry.endsWith("/") ? file.startsWith(entry) : file === entry)
);
const unexpectedLanes = [...matches].filter((lane) => lane !== declaredLane);
const unownedFiles = changed.filter((file) =>
  ![...ownedFiles.values()].some((files) => files.includes(file))
);

console.log(JSON.stringify({
  branch,
  declaredLane,
  laneSource: explicitLane ? "build-contract" : "dependabot-policy",
  integrationBranch,
  detectedLanes: [...matches].sort(),
  unexpectedLanes: unexpectedLanes.sort(),
  touchesSharedCore,
  changedFiles: changed.length,
  unownedFiles,
  dependabot: dependabotPolicy.isDependabot ? {
    ecosystem: dependabotPolicy.ecosystem,
    safeFiles: dependabotPolicy.safeFiles,
    updateClass: dependabotPolicy.updateClass,
    autoContractEligible: dependabotPolicy.autoContractEligible,
    reason: dependabotPolicy.reason,
  } : null,
}, null, 2));

if (integrationBranch && declaredLane !== "integration") {
  console.error("parallel-build-guard: integration branches must declare Lane: integration.");
  process.exit(1);
}

if (!integrationBranch && declaredLane === "integration") {
  console.error("parallel-build-guard: Lane: integration requires an approved integration branch prefix.");
  process.exit(1);
}

if (!integrationBranch && unexpectedLanes.length) {
  console.error(
    `parallel-build-guard: declared lane "${declaredLane}" modifies ownership from: ${unexpectedLanes.join(", ")}.`
  );
  process.exit(1);
}

if (!integrationBranch && touchesSharedCore && !["foundation", "devops"].includes(declaredLane)) {
  console.error(
    "parallel-build-guard: feature lane touches shared core. Move shared-core work to foundation/devops or an explicit integration branch."
  );
  process.exit(1);
}

if (!integrationBranch && matches.has("foundation") && matches.size > 1) {
  console.error(
    "parallel-build-guard: foundation changes must be isolated from dependent feature lanes."
  );
  process.exit(1);
}
