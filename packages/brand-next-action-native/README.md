# Native Brand Next Best Action Adapter

This package translates organization-bound persisted Product and Campaign state into the canonical Brand Next Best Action core.

Authority rules:
- Product readiness is evaluated with the governed Product readiness core;
- Campaign attention is derived from the Campaign lifecycle core;
- onboarding, entitlement mode, TikTok state, and pending matches must come from server-authoritative organization-bound reads;
- browser counters or priorities are never authoritative;
- OAuth, billing, mutations, and production schema changes stay outside this package.
