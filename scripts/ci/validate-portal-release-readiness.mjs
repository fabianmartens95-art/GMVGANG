import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const requireReady = args.includes("--require-ready");
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
const manifestPath = args.find((value, index) =>
  !value.startsWith("--") && (index === 0 || args[index - 1] !== "--output")
) ?? ".gmvgang/portal-release-readiness.json";

const ALLOWED_STATUS = new Set(["planned", "implemented", "verified"]);
const ALLOWED_CATEGORY = new Set([
  "security",
  "creator",
  "brand",
  "money",
  "reliability",
  "ux",
  "beta",
]);

function fail(message) {
  console.error(`portal-release-readiness: ${message}`);
  process.exit(1);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`cannot read/parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
}

if (manifest?.version !== 1) fail("manifest version must be 1");
if (!nonEmptyString(manifest.product)) fail("product is required");
if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length === 0) {
  fail("at least one scenario is required");
}
if (manifest.policy?.productionPromotion !== "manual-only") {
  fail("productionPromotion must remain manual-only");
}
if (manifest.policy?.verifiedStatus !== "verified") {
  fail("verifiedStatus must be verified");
}
if (manifest.policy?.evidenceRequiredForVerified !== true) {
  fail("verified scenarios must require evidence");
}

const seen = new Set();
const categories = new Set();
const counts = { planned: 0, implemented: 0, verified: 0 };
const blocking = [];

for (const scenario of manifest.scenarios) {
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    fail("every scenario must be an object");
  }
  if (!nonEmptyString(scenario.id) || !/^[a-z0-9][a-z0-9._-]+$/.test(scenario.id)) {
    fail(`invalid scenario id: ${String(scenario.id)}`);
  }
  if (seen.has(scenario.id)) fail(`duplicate scenario id: ${scenario.id}`);
  seen.add(scenario.id);

  if (!ALLOWED_CATEGORY.has(scenario.category)) {
    fail(`invalid category for ${scenario.id}: ${String(scenario.category)}`);
  }
  categories.add(scenario.category);

  if (scenario.required !== true && scenario.required !== false) {
    fail(`required must be boolean for ${scenario.id}`);
  }
  if (!ALLOWED_STATUS.has(scenario.status)) {
    fail(`invalid status for ${scenario.id}: ${String(scenario.status)}`);
  }
  counts[scenario.status] += 1;

  if (!nonEmptyString(scenario.description)) {
    fail(`description is required for ${scenario.id}`);
  }
  if (!Array.isArray(scenario.sourceRefs) || !scenario.sourceRefs.every(nonEmptyString)) {
    fail(`sourceRefs must be a string array for ${scenario.id}`);
  }
  if (!Array.isArray(scenario.evidence) || !scenario.evidence.every(nonEmptyString)) {
    fail(`evidence must be a string array for ${scenario.id}`);
  }
  if (scenario.status === "verified" && scenario.evidence.length === 0) {
    fail(`verified scenario lacks evidence: ${scenario.id}`);
  }
  if (scenario.required && scenario.status !== "verified") {
    blocking.push({
      id: scenario.id,
      category: scenario.category,
      status: scenario.status,
    });
  }
}

for (const category of ALLOWED_CATEGORY) {
  if (!categories.has(category)) fail(`required category is missing: ${category}`);
}

const summary = {
  product: manifest.product,
  version: manifest.version,
  mode: requireReady ? "require-ready" : "schema",
  total: manifest.scenarios.length,
  counts,
  requiredBlocking: blocking.length,
  blocking,
  productionPromotion: manifest.policy.productionPromotion,
  ready: blocking.length === 0,
};

console.log(JSON.stringify(summary, null, 2));
if (outputPath) writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "## GMVGANG Portal Release Readiness",
    "",
    `- Mode: **${summary.mode}**`,
    `- Total scenarios: **${summary.total}**`,
    `- Verified: **${counts.verified}**`,
    `- Implemented, evidence pending: **${counts.implemented}**`,
    `- Planned: **${counts.planned}**`,
    `- Required blockers: **${summary.requiredBlocking}**`,
    `- Production promotion: **${summary.productionPromotion}**`,
  ];
  if (blocking.length) {
    lines.push("", "### Blocking required scenarios");
    for (const item of blocking) lines.push(`- \`${item.id}\` — ${item.status}`);
  }
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" });
}

if (requireReady && blocking.length > 0) {
  fail(`${blocking.length} required scenario(s) are not verified`);
}
