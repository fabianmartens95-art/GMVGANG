# Notion Creator Synchronization Contract

## Purpose

Connect the existing GMVGANG Company OS Creator database to the proprietary creator-intelligence package without creating a second manually maintained CRM.

Notion remains the operational Single Source of Truth. The software consumes an intentionally narrow projection of creator records for matching, segmentation and later automation.

## Identity

Use the Notion page ID as the stable `CreatorProfile.id` inside the integration layer.

The human-readable Company OS `Creator-ID` may be displayed or referenced operationally, but it is not used as the technical primary key because page IDs remain stable across sorting, views and display-number changes.

The Platform registration flow additionally stores a stable `Platform Creator ID` on the Company OS Creator row. The Platform profile keeps the linked Notion page ID as `creatorMasterId`, so later website profile updates target the existing Creator row instead of creating a parallel record.

## Runtime configuration

The Notion data-source ID and authentication credentials are runtime configuration. Do not hardcode them in the public repository.

The integration layer is responsible for querying the canonical Creator data source and passing rows to `importNotionCreators`.

## Imported Company OS fields

The adapter currently consumes only fields needed for creator intelligence and operational eligibility:

- TikTok Handle
- Profil URL
- Follower
- Ø Views letzte 10 Videos
- Account-Region
- Haupt-Zielgruppe
- Kategorie
- Content-Format
- Content-Sprache
- Creator-Tier
- Status
- Intake-Stage
- TikTok Shop Erfahrung
- TikTok Shop GMV 30 Tage
- Live Erfahrung
- Video-Kapazität / Woche
- LIVE-Verfügbarkeit / Woche
- Compliance-Risiko
- Legal Hold
- TikTok Verstöße 90 Tage
- Creator nicht aufnehmen
- Raus
- Löschstatus
- Screening-Score (manuell)

The exact names are centralized in `notionCreatorProperties` so schema drift is visible and testable.

## Explicitly excluded personal data

The creator-intelligence projection must not import fields that are unnecessary for matching or segmentation, including:

- E-Mail
- WhatsApp / Telefon
- Anschrift
- Versandadresse
- Rechnungsanschrift
- tax identifiers
- contract documents
- signature references
- other billing or legal-document payloads

Those fields remain in Company OS and can only be used by workflows that have a specific operational and legal need for them.

## Eligibility gates

The adapter converts operational blockers into machine-readable exclusion reasons.

Current gates:

- `legal-hold`
- `manual-exclusion`
- `compliance-blocker`
- `active-tiktok-violation`
- `rejected`
- `retention-blocked`
- missing TikTok handle makes the record non-matchable

The batch import returns `excludedCreatorIds`, which can be merged into a product matching profile's existing exclusion set.

## Category normalization

Company OS category labels are mapped to stable software slugs. Examples:

- Beauty -> `beauty`
- Gaming -> `gaming`
- Haushalt / Home & Living -> `home-living`
- Technik / Electronics -> `electronics`
- Health & Wellness -> `health-wellness`

The normalization layer is intentionally explicit rather than inferred by AI so historical matching results remain reproducible.

## Performance boundary

Company OS currently contains useful qualitative and banded indicators, but the Creator Performance Score expects verified quantitative metrics such as GMV, orders, conversion rate, post count, LIVE hours and sample-to-post rate.

Therefore:

1. Notion fields are not converted into invented exact performance values.
2. Verified performance can be injected by creator ID from an authorized TikTok Shop or analytics integration.
3. Until performance is linked, the adapter uses a conservative zero baseline and emits `performance-not-linked`.
4. The qualitative GMV band remains available in `CreatorOperationsSnapshot` for operational filters, but not as fabricated quantitative GMV.

## Segments and lists

`CreatorSegmentDefinition` provides reusable filters across intelligence and operational data, including:

- market
- language
- category
- content channel
- creator tier
- lifecycle status
- intake stage
- shop / LIVE experience
- compliance risk
- minimum followers
- minimum performance score
- eligibility-only mode

`segmentCreators` evaluates a segment and returns explainable members. `materializeCreatorList` creates a timestamped list of creator IDs from that segment.

Example use cases:

- Active Beauty creators in Germany
- LIVE-capable Growth-tier creators
- Eligible creators with at least 10,000 followers
- Re-engagement pool excluding compliance and legal blockers
- Product-specific shortlist input before the matching engine

## Sync direction

The creator-intelligence path remains read-heavy:

```text
Company OS Creator DB
        |
        v
Notion row projection
        |
        v
importNotionCreators
        |
        +--> CreatorProfile[]
        +--> CreatorOperationsSnapshot[]
        +--> excludedCreatorIds[]
        +--> warnings[]
        |
        v
Segmentation + Matching
```

The public Platform registration/profile flow has one deliberately narrow writeback path into the same Company OS Creator SSOT. It is separate from creator intelligence and does not authorize general CRM mutation.

## Website registration/profile writeback ownership

When a website Creator does not yet have an operational Company OS row, the Platform Server may create one and initialize only the registration-owned fields:

- `Platform Creator ID`
- TikTok profile identity/profile URL
- website-provided category, language and market when present
- age/privacy confirmations captured by the registration flow
- `Bewerbung Quelle = Website`
- initial `Status = Beworben`
- initial `Intake-Stage = Neu – Runde 1`

After that row exists, website profile synchronization owns only stable identity/profile fields such as Platform Creator ID, TikTok name/handle/profile URL, category, language and market.

**Existing operational lifecycle fields are protected from profile synchronization.** Updates must not overwrite `Status`, `Intake-Stage`, `Bewerbung Quelle`, age confirmation or privacy confirmation. Those fields belong to the operational Company OS workflow after creation. This prevents a Creator who has already progressed through Screening, Onboarding or activation from being reset to the initial application state by a later profile edit.

The writeback resolves rows in this order:

1. linked Notion page ID (`creatorMasterId`),
2. exact stable `Platform Creator ID`,
3. create a new row only if neither identity resolves.

Duplicate Company OS rows for the same Platform Creator ID fail closed rather than choosing an arbitrary row.

## Done criteria for this contract

- real Company OS field names mapped explicitly
- PII excluded by design
- legal/compliance/retention exclusions machine-readable
- missing performance handled without fabrication
- reusable creator segments supported
- deterministic materialized lists supported
- website registration links into the existing Company OS Creator SSOT
- subsequent profile updates preserve operational lifecycle/intake state
- duplicate Platform Creator IDs fail closed
- unit tests use synthetic data only
- no Notion token, data-source ID or creator personal data committed
