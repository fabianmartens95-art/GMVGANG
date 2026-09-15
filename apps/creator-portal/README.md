# GMVGANG Creator Portal

Private-beta shell for the GMVGANG Creator Network.

## Current scope

- public creator registration UI
- referral deep links via `?ref=CODE`
- registration validation from `@gmvgang/creator-growth`
- GMVGANG CI-compliant responsive layout
- no PII persistence and no public webhook exposure

## Security boundary

This app intentionally does not send registration PII until the server-side authentication and Company OS adapter are connected. Do not expose a Make webhook or Notion credential in Vite environment variables.

The production flow is: browser -> authenticated GMVGANG server boundary -> creator-growth validation/fraud gates -> approved Company OS adapter -> existing Creator SSOT.

## Next

1. authentication provider adapter
2. server-side registration command and audit event
3. Company OS creator upsert using the existing Creator SSOT
4. profile-completion flow
5. creator dashboard and Referral Hub
