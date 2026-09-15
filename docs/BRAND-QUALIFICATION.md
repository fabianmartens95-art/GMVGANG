# Brand Qualification Engine

Status: planned for Phase 1.

The engine will provide deterministic, explainable brand opportunity scoring without becoming a second CRM.

Key constraints:

- Inputs are normalized signals, not persisted customer records.
- Weights and thresholds are caller-provided until GMVGANG standardizes them.
- Scores must expose criterion-level contributions and reasons.
- The engine remains independent from Notion and UI integrations.
- A later adapter may map existing Notion fields into this model read-only.
