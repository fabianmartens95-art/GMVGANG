# GMVGANG Creator Registration

Provider-neutral application/domain commands for public Creator registration and profile completion.

## Boundaries

- Uses `@gmvgang/platform-foundation` for Creator lifecycle, profile completion and immutable referral primitives.
- Owns no database and does not replace the Notion Creator SSOT.
- Persistence, consent evidence, IDs and audit events are explicit ports so a later production adapter can write to the approved existing systems.
- Registration is idempotent per trusted platform user and unique TikTok handle.
- Referral attribution is captured only during the initial registration window and cannot be rewritten later.
- Suspicious trusted fraud signals move the attribution to `fraud_review`; registration itself does not create or approve monetary rewards.
- A Portal account/registered profile is not equivalent to admission to the contractual GMVGANG Creator Network.

## Next adapter gate

After the concrete production Auth/Persistence decision, bind these ports to the server-side platform identity layer and the existing Creator SSOT, then expose authenticated registration/profile-completion endpoints to the Portal.
