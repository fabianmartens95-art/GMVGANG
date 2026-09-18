# Integration Wave V2

Status: active engineering standard after merge  
Effective: 2026-09-18

## Purpose

Integration Wave V2 batches compatible, explicitly opted-in pull requests on one temporary integration revision before promotion to `main`.

The flow is:

`individual PR CI -> compatibility gate -> temporary integration branch -> combined PR CI -> up-to-date check -> merge promotion`

## Routing

- `Auto merge: yes` + `Integration wave: no` uses Automatic Integration Queue V1.
- `Auto merge: yes` + `Integration wave: yes` uses Integration Wave V2.
- Production gates, Founder Decisions, drafts, untrusted forks, requested changes and unresolved dependencies are never wave-eligible.

## Compatibility gate

Before a wave is created, each source PR must have its required repository CI green. The control plane rejects protected/shared-core paths from .gmvgang/integration-wave-v2.json, large PRs, overlapping files and incompatible merge results.

A wave requires at least two compatible source PRs and is capped at the configured batch size.

## Combined verification

Source PR heads are merged into a temporary `integration/wave-v2-*` branch through the GitHub merge API. The privileged workflow never checks out or executes source PR code.

GitHub then opens one integration PR. The normal repository CI runs on the exact combined revision. Promotion is blocked until the branch is current with `main` and the required check `quality` plus all current checks are green.

## Promotion

The integration PR is merged with a merge commit, preserving source commit ancestry. Source PRs are linked to the integration wave and closed after successful promotion if GitHub has not already closed them.

If a source head changes, a source becomes ineligible, the integration branch conflicts, or metadata is invalid, the wave is invalidated and rebuilt from fresh state.

## Safety boundary

Integration Wave V2 does not weaken Production, Founder, Security, Privacy, Financial, Ledger, Settlement, Payment, Recovery or Compliance gates. Sensitive/shared-core paths remain serialized and use the existing task-specific review path.

## Operating rule

Use V2 for small-to-medium independent slices whose interaction risk is best tested together. Use V1 for single isolated reversible work. Shared-core or irreversible changes remain serialized.
