# Brand Qualification Engine

Status: implemented in Phase 1.

The engine provides deterministic, explainable brand opportunity scoring without becoming a second CRM.

## Contract

Each criterion supplies:

- a unique `id`
- a normalized `score` from 0 to 100
- a positive `weight`
- an optional label
- an optional hard gate with pass/fail state and reason

The caller also supplies two thresholds:

- `qualifiedMinScore`
- `reviewMinScore`

The result contains:

- total weighted score
- status: `qualified`, `review` or `reject`
- hard-gate failure state and reasons
- normalized criterion weights
- weighted contribution per criterion

## Decision rules

1. Scores and weights are validated before evaluation.
2. The total score is the weighted average of all criterion scores.
3. Any failed hard gate forces `reject`, regardless of the numerical score.
4. Without a hard-gate failure, the caller-provided thresholds determine `qualified`, `review` or `reject`.
5. Weights and thresholds remain caller-provided until GMVGANG explicitly standardizes them as founder-level policy.

## Boundaries

- Inputs are normalized signals, not persisted customer records.
- No Notion, CRM or UI dependency exists in the core package.
- The package does not infer factual brand data by itself.
- A later read-only adapter may map existing Notion fields into the model.
- Customer data and secrets must not be committed to the repository.

## Intended use

The first use cases are lead prioritization, sales qualification and pilot suitability. Later modules may consume the score as one signal among economics, creator-fit and performance data rather than treating it as an opaque absolute truth.
