# GMVGANG Platform Foundation

Shared domain foundation for GMVGANG account, role, profile, referral-attribution, external-connection and server-resolved session models.

This package intentionally contains domain logic only. It does not own authentication transport, provider credentials, persistence, UI or secrets. Operational master data remains in the GMVGANG Company OS until a separately approved source-of-truth migration is executed.

## Session boundary

`resolvePlatformSession` accepts only a verified provider identity that has already been mapped to a GMVGANG `PlatformUser`. It then enforces account state, expiry, active memberships, active organizations and explicit tenant selection.

Important defaults:

- no identity resolves to anonymous
- unverified email, expired identity or inactive account fails closed
- a requested organization requires an active membership
- a single active organization can be selected automatically
- multiple active organizations without an explicit selection never merge roles across tenants
- an authenticated account without a membership receives no portal role, which keeps registration/onboarding possible without granting tenant access
