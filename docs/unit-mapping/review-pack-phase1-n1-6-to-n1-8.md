# Phase 1 Review Pack: N1.6 to N1.8

This is the first offline-authored curriculum pack for phase 1.

File:
- `docs/unit-mapping/review-pack-phase1-n1-6-to-n1-8.jsonl`

Scope:
- `N1.6` Decimal place value
- `N1.7` Compare decimals using `=, ≠, <, >, ≤, ≥`
- `N1.8` Order a list of decimals

Item count:
- `N1.6`: 6 items
- `N1.7`: 7 items
- `N1.8`: 6 items
- Total: `19`

Routing intent encoded in `source.question_ref`:
- `ONB`: onboarding
- `LRN`: main learn/practice
- `RT`: reteach

Answer-mode intent in this pack:
- `N1.6`: `MCQ`, `NUMERIC`, `SHORT`
- `N1.7`: `TRUE_FALSE` behaviour encoded via `MCQ` with `True/False` options, plus `SHORT` and `NUMERIC`
- `N1.8`: ordered-response tasks encoded as `SHORT` with comma-separated accepted answers, pending richer ordered UI import support

Important notes:
- This pack follows the newer question-choice rules even though the legacy JSONL schema in this checkout is narrower than the newer content contract.
- `N1.8` items are intentionally not standard MCQ except for a single onboarding recognition check.
- `N1.7` uses direct symbol-entry and true/false checks instead of padded four-option MCQs.
- `N1.6` includes explicit place-value and representation-switch reteach items rather than repeats.

Next recommended content batches:
1. `N1.9` to `N1.12`
2. `N1.13` to `N1.15`
3. `N2.1` to `N2.4`
