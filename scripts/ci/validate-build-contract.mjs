import { readFileSync } from "node:fs";

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

function required(pattern, message) {
  if (!pattern.test(body)) errors.push(message);
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

for (const heading of ["Goal", "Scope", "Do not touch", "Acceptance criteria"]) {
  const section = new RegExp(
    `## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "i"
  ).exec(body)?.[1]?.trim() ?? "";
  if (!section || /<!--/.test(section)) {
    errors.push(`Complete the "${heading}" section.`);
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
  for (const error of errors) console.error(`- ${error}`);
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
}, null, 2));