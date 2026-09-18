# GMVGANG Automatic Integration Queue V1

Status: active engineering standard after merge  
Effective: 2026-09-18

## Goal

Remove manual merge/rebase waiting from the Autonomous Parallel Build Loop without weakening production, security or founder gates.

The optimized loop is:

`Ready task -> isolated branch -> implementation -> CI -> lane guard -> queue -> exact-head merge/update -> fresh CI -> next task`

## Queue eligibility

A pull request is eligible only when all of the following are explicit and true:

- it targets `main`, is non-draft and comes from this repository;
- the author is an OWNER, MEMBER or COLLABORATOR;
- `Auto merge: yes`;
- `Integration wave: yes` PRs are excluded from V1 and routed to Wave V2;
- `Production gate: no`;
- `Founder decision: no`;
- declared `Depends on` references are already merged/closed;
- both required checks, `quality` and `lane-guard`, exist and succeed;
- every current check run is completed with success/neutral/skipped;
- no active review has requested changes;
- no blocking label such as `queue:hold`, `gate:production`, `gate:founder` or `do-not-merge` exists.

Anything ambiguous fails closed and remains open.

## Serialization model

The queue performs at most one repository mutation per run. It is triggered after CI or the Parallel Build Guard completes (or by explicit workflow dispatch), so PR-body changes must first pass the guard before they can influence an automatic merge decision.

1. Prefer one fully green, current PR and squash-merge its exact verified head SHA.
2. If no current PR is merge-ready, update one green-but-behind PR onto current `main`.
3. The resulting CI/guard runs trigger the next queue evaluation.

This makes workers replaceable and prevents concurrent merges from racing the same base.

## Safety boundaries

The queue never checks out PR head code and never executes code supplied by a pull request. The workflow executes only the trusted policy from `main` and reads GitHub metadata/check results.

Production gates, founder decisions, unresolved dependencies, requested changes, conflicts and failing/pending checks all block automation.

Database migrations, authentication/authorization changes, shared-core changes and irreversible operations should use `Auto merge: no` unless their task-specific gate explicitly proves they are safe for automatic integration.

## Throughput rule

Use `Auto merge: yes` for small, isolated and reversible PRs. Keep shared-core foundation changes serialized. Once a shared primitive lands, dependent streams should update and rerun CI rather than merging stale heads.

## Integration Wave V2

Integration Wave V2 is active alongside this queue. PRs with `Integration wave: yes` are excluded from V1 and routed to the combined-revision workflow documented in `docs/INTEGRATION_WAVE_V2.md`. V1 remains the path for single isolated reversible PRs.