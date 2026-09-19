import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDependabotPolicy } from "./dependabot-policy.mjs";

function pr({ login = "dependabot[bot]", branch, title, body = "" }) {
  return {
    user: { login },
    head: { ref: branch },
    title,
    body,
  };
}

test("allows npm patch/minor manifest-only updates", () => {
  const result = evaluateDependabotPolicy(
    pr({
      branch: "dependabot/npm_and_yarn/production-dependencies-abc",
      title: "build(deps): bump @supabase/ssr from 0.12.0 to 0.12.7",
    }),
    ["package.json", "pnpm-lock.yaml"],
  );

  assert.equal(result.autoContractEligible, true);
  assert.equal(result.lane, "devops");
  assert.equal(result.updateClass, "minor-or-patch");
});

test("blocks npm updates that touch source files", () => {
  const result = evaluateDependabotPolicy(
    pr({
      branch: "dependabot/npm_and_yarn/production-dependencies-abc",
      title: "build(deps): bump example from 1.2.0 to 1.3.0",
    }),
    ["package.json", "apps/platform-server/src/server.ts"],
  );

  assert.equal(result.autoContractEligible, false);
  assert.equal(result.reason, "unexpected-files");
  assert.deepEqual(result.unsafeFiles, ["apps/platform-server/src/server.ts"]);
});

test("requires an explicit contract for major npm updates", () => {
  const result = evaluateDependabotPolicy(
    pr({
      branch: "dependabot/npm_and_yarn/vite-8",
      title: "build(deps-dev): bump vite from 7.1.4 to 8.3.0",
    }),
    ["package.json", "pnpm-lock.yaml"],
  );

  assert.equal(result.safeFiles, true);
  assert.equal(result.updateClass, "major");
  assert.equal(result.autoContractEligible, false);
});

test("allows patch/minor GitHub Actions workflow-only updates", () => {
  const result = evaluateDependabotPolicy(
    pr({
      branch: "dependabot/github_actions/actions/checkout-4.2.3",
      title: "build(deps): bump actions/checkout from 4.2.2 to 4.2.3",
    }),
    [".github/workflows/ci.yml"],
  );

  assert.equal(result.autoContractEligible, true);
  assert.equal(result.ecosystem, "github-actions");
});

test("rejects spoofed authors even on dependabot branches", () => {
  const result = evaluateDependabotPolicy(
    pr({
      login: "someone-else",
      branch: "dependabot/npm_and_yarn/example",
      title: "build(deps): bump example from 1.0.0 to 1.1.0",
    }),
    ["package.json"],
  );

  assert.equal(result.isDependabot, false);
  assert.equal(result.autoContractEligible, false);
});

test("fails closed when the version change cannot be classified", () => {
  const result = evaluateDependabotPolicy(
    pr({
      branch: "dependabot/npm_and_yarn/example",
      title: "build(deps): refresh dependency group",
    }),
    ["package.json"],
  );

  assert.equal(result.updateClass, "unknown");
  assert.equal(result.autoContractEligible, false);
});
