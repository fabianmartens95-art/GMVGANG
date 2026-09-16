# GMV Core Engineering Standard

This repository follows a common engineering baseline shared across GMV projects while keeping business domains, repositories, credentials and sensitive data separate.

## Core request path

`Identity -> Authorization -> Server-authoritative business logic -> Event/Audit trail -> Idempotency -> Database -> Observability -> Recovery`

## GMVGANG requirements

- Identity is centralized; clients do not become separate account systems.
- Role and tenant authorization is enforced server-side.
- Campaign status, creator assignments, permissions, billing and financial calculations must not be client-authoritative.
- Mutating operations must be designed for safe retries and receive idempotency protection where duplicate execution has business impact.
- Material business mutations must be attributable through append-only audit events.
- Operational requests use correlation IDs so logs, errors and downstream work can be traced.

## Production gate

A feature is not production-ready merely because implementation is complete. Production promotion requires all applicable gates:

1. Typecheck passes.
2. Automated tests pass, including negative authorization paths where relevant.
3. Build passes.
4. Database migrations and verification scripts are reviewed for schema changes.
5. Staging runs the intended revision.
6. Critical end-to-end flows pass against staging.
7. Health/readiness checks pass.
8. Smoke tests pass after promotion.
9. Observability can correlate failures to a request or business operation.
10. A rollback or recovery path exists for changes that can affect persistent state.

## Phase gates

Development phases are entered by demonstrated maturity rather than calendar date. A later phase should solve a validated product, scale, operational or architecture constraint. A redesign alone is not a maturity gate.

## Separation rule

Patterns may be reused across GMV projects only when they are generic and stable. Domain logic, production credentials and sensitive datasets stay isolated by project.
