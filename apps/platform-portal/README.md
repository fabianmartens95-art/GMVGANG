# GMVGANG Platform Portal

Shared web shell for the future Creator Portal, Brand Portal and internal Team Workspace.

## Current boundary

This app is intentionally provider-neutral. It consumes `@gmvgang/platform-foundation` for role/capability decisions and fails closed in production until a real authentication adapter is connected.

The current `EnvironmentSessionAdapter` exists only for local development previews. `VITE_PLATFORM_DEV_ROLE` and `VITE_PLATFORM_DEV_ORGANIZATION_ID` are ignored by production builds because the adapter only honors them when `import.meta.env.DEV` is true.

## Areas

- `/` — public platform overview
- `/creator` — Creator Portal shell; requires `creator.portal.access`
- `/brand` — Brand Portal shell; requires `brand.portal.access`
- `/team` — internal workspace shell; requires `team.workspace.read`

## Development

```bash
cp apps/platform-portal/.env.example apps/platform-portal/.env.local
pnpm --filter @gmvgang/platform-portal dev
```

Change `VITE_PLATFORM_DEV_ROLE` locally to preview permitted areas.

## Security / SSOT

- Production is anonymous until a real Auth adapter is configured.
- Portal route access is derived from shared capabilities, not hard-coded duplicate role rules.
- No API tokens, passwords, Creator PII or customer data belong in the repository.
- Notion / GMVGANG Company OS remains the operational SSOT during this phase.
- The next implementation step is a production Auth/Persistence adapter plus Public Creator Registration, Profile Completion and immutable Referral Capture.
