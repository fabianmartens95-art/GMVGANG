# GMVGANG Platform Access Architecture

## Decision

GMVGANG is built as a multi-tenant platform from the foundation so that agency staff, external specialists, client brands and creators can authenticate into the same product without a rewrite.

Authentication is commodity infrastructure and should be integrated through a proven provider. Authorization, tenant isolation and GMVGANG-specific business permissions remain owned domain logic.

## One login, role-aware workspace

Use one authentication entry point. After login, GMVGANG resolves the user's membership, role, assigned brands and explicit permission overrides, then renders only the modules appropriate for that person.

This avoids separate employee, freelancer, brand and creator applications while still enforcing strict server-side access control.

## User surfaces

### Internal / Partner Agency Cockpit

Users:
- GMVGANG owner and admins
- employees
- freelancers / contractors
- closers
- creator managers
- brand managers

The cockpit is role-aware. A closer should see the sales pipeline and approved brand/economics information, but not creator sample operations. A creator manager should manage creators, outreach, campaigns and samples for assigned brands, but should not automatically receive commercial or administrative privileges. A brand manager should manage assigned client brands and campaigns without gaining user-administration rights.

### Brand Portal

Users: client brand admins and brand members.

Brand-scoped access only.

Planned capabilities:
- dashboard and GMV analytics
- products
- assigned creators
- campaign progress
- sample funnel
- content library
- reports
- profitability views where enabled
- approvals and decision gates
- tasks / requests

A brand must never be able to query another brand's private data.

### Creator Portal

Users: creators with an accepted/onboarded account.

Creator-scoped access only.

Planned capabilities:
- creator profile
- active opportunities
- campaigns and briefs
- sample status
- deliverables
- content submission/status
- performance and GMV views where available
- payout / commission information where supported
- contracts/onboarding status
- notifications

A creator must not gain broad brand, agency or other-creator access through the portal.

## Roles

Initial roles:
- `agency_owner`
- `agency_admin`
- `agency_operator`
- `closer`
- `creator_manager`
- `brand_manager`
- `external_contractor`
- `brand_admin`
- `brand_member`
- `creator`

The domain permission engine is implemented in `@gmvgang/access-control`.

### Role presets

`closer`
- assigned brands / leads
- sales pipeline read/write
- approved analytics, reports and economics
- no sample operations by default

`creator_manager`
- assigned brand context
- creator read/write
- outreach read/write
- campaign operations
- sample operations
- analytics/reporting read
- no brand administration by default

`brand_manager`
- assigned brands only
- brand operations
- campaigns
- creator visibility
- analytics/reporting
- economics visibility
- no platform user administration

`external_contractor`
- deny-by-default profile
- receives only explicitly granted permissions
- still restricted to assigned brand IDs

Specific permissions can be explicitly granted or revoked without creating a new hard-coded role for every freelancer or specialist.

## Tenant model

Primary hierarchy:

```text
GMVGANG workspace
  |-- Brand A
  |    |-- products
  |    |-- campaigns
  |    |-- samples
  |    |-- analytics
  |    |-- assigned staff / contractors
  |    `-- brand users
  |
  |-- Brand B
  |    `-- ...
  |
  |-- creators
  |    `-- brand/campaign relationships
  |
  `-- agency users / external collaborators
```

Every private resource must be workspace-scoped. Brand-private resources must additionally be brand-scoped. Creator-private resources must additionally be creator-scoped.

## Security rules

1. Deny by default.
2. Every authenticated request resolves one principal and one workspace membership.
3. Brand data is filtered by authorized brand IDs before business logic returns data.
4. Creator self-service data is filtered by the authenticated creator ID.
5. Server-side authorization is mandatory; UI hiding is never considered authorization.
6. High-impact actions keep explicit approval gates and audit records.
7. Cross-tenant IDs supplied by clients must not override server-derived scope.
8. Public/share links use dedicated, revocable, narrowly-scoped tokens rather than normal user sessions.
9. External contractors receive least-privilege access only.
10. Employee/freelancer access can be revoked without deleting business records or shared history.

## Authentication boundary

Do not build password storage or session cryptography ourselves. Integrate a mature authentication provider when the first portal goes live. The provider should handle login/session/MFA; GMVGANG maps the authenticated identity to `PlatformMembership` and performs authorization with owned domain rules.

Potential login methods can later include email magic link, password/passkey and selected SSO/OAuth options based on business need.

## Rollout

### Stage 1 — now
- tenant and role model
- authorization package
- staff and contractor role presets
- workspace / brand / creator IDs in domain models
- server authorization hooks
- tests for isolation

### Stage 2 — internal and external workforce accounts
- GMVGANG team authentication
- closer / creator-manager / brand-manager accounts
- freelancer/contractor invitations
- brand assignments
- granular permission overrides
- access revocation
- audit log

### Stage 3 — Brand Portal
- brand invitations
- brand-admin/member roles
- read-heavy dashboard first
- approvals second

### Stage 4 — Creator Portal
- creator invitation/onboarding
- own profile
- sample/campaign workflow
- content and performance

### Stage 5 — advanced identity
- MFA enforcement by role
- optional SSO for larger clients
- granular permissions
- time-limited external access
- API credentials / MCP scopes

## Definition of done

The platform-access foundation is complete when automated tests prove that:
- agency users cannot cross workspaces,
- restricted staff cannot cross assigned brands,
- closers cannot use creator-operations permissions by default,
- creator managers cannot administer brands by default,
- brand managers cannot administer users by default,
- external contractors are deny-by-default except for explicit grants,
- brand users cannot cross brands,
- creator users can access only their own creator-scoped private resources,
- unauthorized permissions are denied server-side,
- access decisions can be logged/audited.
