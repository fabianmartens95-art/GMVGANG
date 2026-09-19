import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evaluateDependabotPolicy } from "./dependabot-policy.mjs";

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.error("build-contract: GITHUB_EVENT_PATH is required");
  process.exit(2);
}

const event = JSON.parse(readFileSync(eventPath, "utf8"));
const pullRequest = event.pull_request;
if (!pullRequest) {
  console.error("build-contract: pull_request payload is required");
  process.exit(2);
}

const body = typeof pullRequest.body === "string" ? pullRequest.body : "";
const errors = [];
const v3CutoverPrNumber = 272;
const v3Required = Number(pullRequest.number ?? 0) >= v3CutoverPrNumber;
const explicitLane = /^Lane:\s*(foundation|creator|brand|commerce|web|devops|integration)\s*$/im.exec(body)?.[1] ?? null;

const base = pullRequest.base?.sha;
const head = pullRequest.head?.sha;
if (!base || !head) {
  console.error("build-contract: pull_request base/head SHA are required");
  process.exit(2);
}

const changed = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const dependabotPolicy = evaluateDependabotPolicy(pullRequest, changed);

if (dependabotPolicy.isDependabot && !dependabotPolicy.supportedEcosystem) {
  errors.push("Dependabot ecosystem is not approved by the dependency governance policy.");
}

if (dependabotPolicy.isDependabot && !dependabotPolicy.safeFiles) {
  errors.push(
    `Dependabot changed files outside the approved dependency surface: ${dependabotPolicy.unsafeFiles.join(", ") || "none"}.`,
  );
}

if (!explicitLane && dependabotPolicy.autoContractEligible) {
  console.log(JSON.stringify({
    scope: "gmvgang.build-contract",
    pullRequest: pullRequest.number,
    branch: pullRequest.head?.ref ?? null,
    synthetic: true,
    source: "dependabot-policy",
    lane: "devops",
    priority: "P1",
    dependsOn: "none",
    autoMerge: false,
    productionGate: false,
    founderDecision: false,
    documentationGate: v3Required ? "v3-synthetic-none" : "v2-grandfathered",
    notionImpact: "none",
    ceoImpact: "no",
    ecosystem: dependabotPolicy.ecosystem,
    updateClass: dependabotPolicy.updateClass,
    changedFiles: changed,
  }, null, 2));
  process.exit(0);
}

if (!explicitLane && dependabotPolicy.isDependabot) {
  errors.push(
    `Dependabot PR is not eligible for a synthetic Build contract (${dependabotPolicy.reason}); use the normal explicit Build contract for reviewed exceptions.`,
  );
}

function required(pattern, message) {
  if (!pattern.test(body)) errors.push(message);
}

function field(name) {
  const escaped = name.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
  return new RegExp("^" + escaped + ":\\s*(.+?)\\s*$", "im").exec(body)?.[1]?.trim() ?? "";
}

required(/^Lane:\s*(foundation|creator|brand|commerce|web|devops|integration)\s*$/im,
  "Declare a valid Lane in the Build contract.");
required(/^Priority:\s*P[0-2]\s*$/im,
  "Declare Priority as P0, P1, or P2.");
required(/^Depends on:\s*\S.+$/im,
  'Declare dependencies explicitly, using "none" when there are none.');
required(/^Auto merge:\s*(yes|no)\s*$/im,
  "Declare Auto merge as yes or no.");
required(/^Production gate:\s*(yes|no)\s*$/im,
  "Declare Production gate as yes or no.");
required(/^Founder decision:\s*(yes|no)\s*$/im,
  "Declare Founder decision as yes or no.");

if (v3Required) {
  required(/^Documentation gate:\s*v3\s*$/im,
    "Declare Documentation gate as v3.");
  required(/^Notion impact:\s*(none|update|new decision|roadmap)\s*$/im,
    "Declare Notion impact as none, update, new decision, or roadmap.");
  required(/^Canonical Notion page:\s*\S.+$/im,
    'Declare the Canonical Notion page, using "none" only when Notion impact is none.');
  required(/^Notion writeback targets:\s*\S.+$/im,
    'Declare all Notion writeback targets, using "none" only when no writeback is required.');
  required(/^CEO impact:\s*(yes|no)\s*$/im,
    "Declare CEO impact as yes or no.");
  required(/^CEO Control Center:\s*(pending|synced|not required)\s*$/im,
    "Declare CEO Control Center as pending, synced, or not required.");
  required(/^Notion synced:\s*(yes|no)\s*$/im,
    "Declare Notion synced as yes or no.");
  required(/^Verification:\s*(re-fetch verified|pending|not required)\s*$/im,
    "Declare Verification as re-fetch verified, pending, or not required.");

  const notionImpact = field("Notion impact").toLowerCase();
  const canonicalNotionPage = field("Canonical Notion page");
  const writebackTargets = field("Notion writeback targets");
  const ceoImpact = field("CEO impact").toLowerCase();
  const ceoControlCenter = field("CEO Control Center").toLowerCase();
  const notionSynced = field("Notion synced").toLowerCase();
  const verification = field("Verification").toLowerCase();

  if (notionImpact !== "none") {
    if (canonicalNotionPage.toLowerCase() === "none") {
      errors.push("A relevant Notion impact requires a canonical Notion page.");
    }
    if (writebackTargets.toLowerCase() === "none") {
      errors.push("A relevant Notion impact requires explicit Notion writeback targets.");
    }
    if (notionSynced !== "yes") {
      errors.push("Documentation Consistency Gate V3 requires Notion synced: yes before the PR can pass the build-contract gate.");
    }
    if (verification !== "re-fetch verified") {
      errors.push("Documentation Consistency Gate V3 requires Verification: re-fetch verified for relevant Notion impact.");
    }
  }

  if (ceoImpact === "yes") {
    const targetsCeo = /CEO Control Center|3d076c6817ac814a8332f5f10ce3aeb8/i.test(writebackTargets);
    if (!targetsCeo) {
      errors.push("CEO impact: yes requires CEO Control Center in Notion writeback targets.");
    }
    if (ceoControlCenter !== "synced") {
      errors.push("CEO impact: yes requires CEO Control Center: synced before the PR can pass the build-contract gate.");
    }
    if (verification !== "re-fetch verified") {
      errors.push("CEO impact: yes requires re-fetch verification of the canonical page and CEO Control Center.");
    }
  }

  if (ceoImpact === "no" && ceoControlCenter === "pending") {
    errors.push("CEO Control Center cannot be pending when CEO impact is no.");
  }

  if (notionImpact === "none" && notionSynced === "yes" && verification === "pending") {
    errors.push("Notion impact: none cannot claim a pending verification while Notion synced is yes.");
  }
}

for (const heading of ["Goal", "Scope", "Do not touch", "Acceptance criteria"]) {
  const section = new RegExp(
    "## " + heading + "\\s*\\n([\\s\\S]*?)(?=\\n## |$)",
    "i"
  ).exec(body)?.[1]?.trim() ?? "";
  if (!section || /<!--/.test(section)) {
    errors.push('Complete the "' + heading + '" section.');
  }
}

const autoMerge = /^Auto merge:\s*yes\s*$/im.test(body);
const productionGate = /^Production gate:\s*yes\s*$/im.test(body);
const founderDecision = /^Founder decision:\s*yes\s*$/im.test(body);

if (autoMerge && (productionGate || founderDecision)) {
  errors.push("Auto merge cannot be yes when a Production gate or Founder decision is required.");
}

if (productionGate) {
  const section = /## Production gate\s*\n([\s\S]*?)(?=\n## |$)/i.exec(body)?.[1]?.trim() ?? "";
  if (!section || /<!--/.test(section)) {
    errors.push('Production gate is "yes" but the Production gate verification section is empty.');
  }
}

if (errors.length) {
  console.error("build-contract validation failed:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log(JSON.stringify({
  scope: "gmvgang.build-contract",
  pullRequest: pullRequest.number,
  branch: pullRequest.head?.ref ?? null,
  lane: /^Lane:\s*([^\n]+)$/im.exec(body)?.[1]?.trim() ?? null,
  priority: /^Priority:\s*([^\n]+)$/im.exec(body)?.[1]?.trim() ?? null,
  autoMerge,
  productionGate,
  founderDecision,
  documentationGate: v3Required ? field("Documentation gate") : "v2-grandfathered",
  notionImpact: v3Required ? field("Notion impact") : null,
  ceoImpact: v3Required ? field("CEO impact") : null,
  dependabot: dependabotPolicy.isDependabot ? {
    ecosystem: dependabotPolicy.ecosystem,
    safeFiles: dependabotPolicy.safeFiles,
    updateClass: dependabotPolicy.updateClass,
    autoContractEligible: dependabotPolicy.autoContractEligible,
  } : null,
}, null, 2));
