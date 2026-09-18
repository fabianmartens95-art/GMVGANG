# GMVGANG Automatic Integration Queue V1

Status: active engineering standard after merge  
Effective: 2026-09-18

## Goal

Remove manual merge/rebase waiting from the Autonomous Parallel Build Loop without weakening production, security or founder gates.

The optimized loop is:

`Ready task -> isolated branch -> implementation -> CI -> queue -> exact-head merge/update -> fresh CI -> next task`

## Queue eligibility

A pull request is eligible only when all of the following are explicit and true:

- it targets `main`, is non-draft and comes from this repository;
- the author is an OWNER, MEMBER or COLLABORATOR;
- `Auto merge: yes`;
- `Production gate: no`;
- `Founder decision: no`;
- declared `Depends on` references are already merged/closed;
- both required checks, `quality` and `lane-guard`, exist and succeed;
- every current check run is completed with success/neutral/skipped;
- no active review has requested changes;
- no blocking label such as `queue:hold`, `gate:production`, `gate:founder` or `do-not-merge` exists.

Anything ambiguous fails closed and remains open.

## Serialization model

The queue performs at most one repository mutation per run. It is triggered only after CI or the Parallel Build Guard completes (or by an explicit workflow dispatch); PR-body edits alone never trigger a merge evaluation.

1. Prefer one fully green, current PR and squash-merge its exact verified head SHA.
2. If no current PR is merge-ready, update one green-but-behind PR onto current `main`.
3. The resulting CI run triggers the next queue evaluation.

This makes workers replaceable and prevents concurrent merges from racing the same base.

## Safety boundaries

The queue never checks out PR head code and never executes code supplied by a pull request. The workflow executes only the trusted policy from `main` and reads GitHub metadata/check results.

Production gates, founder decisions, unresolved dependencies, requested changes, conflicts and failing/pending checks all block automation.

Database migrations, authentication/authorization changes, shared-core changes and irreversible operations should use `Auto merge: no` unless their task-specific gate explicitly proves they are safe for automatic integration.

## Throughput rule

Use `Auto merge: yes` for small, isolated and reversible PRs. Keep shared-core foundation changes serialized. Once a shared primitive lands, dependent streams should update and rerun CI rather than merging stale heads.

## Next optimization

After V1 has stable operational evidence, the next step is an Integration Wave V2 that batches compatible PRs on a temporary integration revision and runs cross-stream E2E before promotion.
