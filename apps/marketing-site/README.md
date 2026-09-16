# GMVGANG Marketing Site

Migration target for the public GMVGANG website from Webflow to the existing GMVGANG monorepo.

## Deployment standard

Production flow is intentionally gated:

`feature branch -> Cloudflare Preview -> QA -> merge to main -> production deploy -> gmvgang.de`

`main` is the production source of truth. Website changes must not be pushed directly to `main` unless explicitly approved as an emergency exception.

## Cloudflare Pages settings

- Repository: `fabianmartens95-art/GMVGANG`
- Production branch: `main`
- Build command: `pnpm --filter @gmvgang/marketing-site build`
- Build output directory: `apps/marketing-site/dist`
- Root directory: repository root
- Preview deployments: enabled for non-production branches
- Production domains after cutover: `gmvgang.de` and `www.gmvgang.de`
- Reserved separately for the product portal: `app.gmvgang.de`

## Migration gates before domain cutover

1. Visual parity / intentional improvements for all public pages.
2. Mobile and keyboard QA.
3. Production-safe Potenzialanalyse migration with the existing Make / Website Intake Log guardrails.
4. Legal pages reviewed for the then-current company and hosting stack.
5. No analytics or advertising pixels before consent/privacy requirements are settled.
6. Canonical, sitemap, robots and metadata reviewed.
7. Cloudflare preview accepted.
8. Founder approval for merge to `main` and DNS cutover.

## Current migration state

The initial static architecture and page shell are implemented on the migration branch. The Potenzialanalyse and legal pages deliberately remain gated and must not be treated as production-ready until the corresponding QA steps pass.
