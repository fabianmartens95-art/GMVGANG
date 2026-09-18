## Build contract

Lane: <!-- foundation | creator | brand | commerce | web | devops | integration -->
Priority: <!-- P0 | P1 | P2 -->
Depends on: <!-- PR/issue numbers or none -->
Auto merge: <!-- yes/no; yes only for isolated, reversible work after CI -->
Integration wave: <!-- yes/no; yes routes this PR to Integration Wave V2 instead of V1 queue -->
Production gate: <!-- yes/no -->
Founder decision: <!-- yes/no -->
Documentation gate: v3
Notion impact: <!-- none | update | new decision | roadmap -->
Canonical Notion page: <!-- exact Notion page URL or "none" -->
Notion writeback targets: <!-- exact Notion page URL(s)/names, or "none" -->
CEO impact: <!-- yes/no; yes for active wave/lane, PR/RC, traffic-light status, blocker, release/production gate, or next-step changes -->
CEO Control Center: <!-- pending | synced | not required -->
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
- [ ] Notion impact and CEO impact classified before merge
- [ ] All required Notion writeback targets completed before DONE
- [ ] CEO Control Center reconciled when CEO impact = yes
- [ ] Required Notion/CEO targets re-fetched and consistency-verified before DONE

## Integration

<!-- Dependency order, shared-core impact and downstream lanes. -->

## Production gate

<!-- Required verification before production promotion, or "Not required." -->

## Documentation

<!-- Summarize Decision/Change, canonical Notion page, all writeback targets, CEO impact, sync status and re-fetch verification. -->
