# GMVGANG Marketing Site

Migration target for the public GMVGANG website from Webflow to the existing GMVGANG monorepo.

## Deployment standard

Production flow is intentionally gated:

`feature branch -> Cloudflare Preview -> QA -> merge to main -> production deploy -> gmvgang.de`

`main` is the production source of truth. Website changes must not be pushed directly to `main` unless explicitly approved as an emergency exception.

## Cloudflare Pages settings

- Repository: `fabianmartens95-art/GMVGANG`
- Production branch after migration cutover: `main`
- Temporary migration branch on Cloudflare: `website/marketing-site-migration`
- Build command: `pnpm --filter @gmvgang/marketing-site build`
- Build output directory: `apps/marketing-site/dist`
- Root directory: repository root
- Preview deployments: enabled for non-production branches
- Production domains after cutover: `gmvgang.de` and `www.gmvgang.de`
- Reserved separately for the product portal: `app.gmvgang.de`

## Safety gates

1. Visual parity / intentional improvements for all public pages.
2. Mobile and keyboard QA.
3. Production-safe Potenzialanalyse migration with the existing Make / Website Intake Log guardrails.
4. Legal pages reviewed for the then-current company and hosting stack.
5. No analytics or advertising pixels before consent/privacy requirements are settled.
6. Canonical, sitemap, robots and metadata reviewed.
7. Cloudflare preview accepted.
8. Founder approval for merge to `main` and DNS cutover.

Additional hardening:

- All pages remain `noindex,nofollow` during the migration preview.
- Real Potential Check submissions are allowlisted to `gmvgang.de` and `www.gmvgang.de`. `*.pages.dev`, localhost, mirrors and other hosts cannot submit to the production Make webhook through the site UI.
- The public form writes only to the append-only Website Intake Log through the existing Make webhook. It does not directly update verified `Brands & Leads` records.
- No analytics or advertising pixels are enabled in this migration.
- `app.gmvgang.de` must not be modified by the marketing-site deployment.

## Verified QA state · 2026-09-16

- Controlled synthetic integration E2E passed: Make webhook → Website Intake Log → `saved:true`; `Brands & Leads` remained unchanged.
- Live Cloudflare route smoke test passed for `/`, `/brands/`, `/creator/`, `/ueber-gmvgang/`, `/potenzialanalyse/`, `/analyse-erhalten/`, `/impressum/`, `/datenschutz/`, `robots.txt` and `sitemap.xml`.
- Security headers are present on Cloudflare responses.
- Mobile navigation supports Escape-to-close and returns focus to the menu control.
- GitHub CI covers typecheck, tests and production build.

## Remaining launch gates

- final visual/browser QA on the current mobile and desktop preview
- final indexability/sitemap decision; `/potenzialanalyse/` is currently excluded from indexing even after the global launch flag is enabled and should be reviewed before cutover
- recheck legal copy against current business/entity/address status
- Cloudflare preview final acceptance
- Founder approval for merge and DNS cutover
