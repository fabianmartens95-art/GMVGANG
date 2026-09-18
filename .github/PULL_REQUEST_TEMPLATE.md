## Build contract

Lane: <!-- foundation | creator | brand | commerce | web | devops | integration -->
Priority: <!-- P0 | P1 | P2 -->
Depends on: <!-- PR/issue numbers or none -->
Auto merge: <!-- yes/no; yes only for isolated, reversible work after CI -->
Integration wave: <!-- yes/no; yes routes this PR to Integration Wave V2 instead of V1 queue -->
Production gate: <!-- yes/no -->
Founder decision: <!-- yes/no -->
Notion impact: <!-- none | update | new decision | roadmap -->
Canonical Notion page: <!-- exact Notion page URL or "none" -->
Notion synced: <!-- no | yes; relevant PRs cannot be DONE until yes -->
Verification: <!-- re-fetch verified | pending | not required -->

## Goal

<!-- One concrete outcome. -->

## Scope

<!-- Files/domains intentionally changed. -->

## Do not touch

<!-- Explicit boundaries for parallel work. -->

## Acceptance criteria

- [ ] Functional behavior implemented
- [ ] Authorization / tenant boundary verified where relevant
- [ ] Idempotency considered for mutations
- [ ] Tests added or updated
- [ ] Typecheck passes
- [ ] Build passes
- [ ] No secrets or PII added to logs
- [ ] Migration / rollback implications documented if applicable
- [ ] Notion impact classified before merge
- [ ] Required Notion SSOT update completed and re-fetched before DONE

## Integration

<!-- Dependency order, shared-core impact and downstream lanes. -->

## Production gate

<!-- Required verification before production promotion, or "Not required." -->

## Documentation

<!-- Summarize Decision/Change, target Notion page, sync status and verification result. -->
