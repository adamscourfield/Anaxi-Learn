# Unit 1 Mapping Rubric (Applications of Numeracy)

Use this rubric to map each curriculum question into an app-ready structure that supports mastery, diagnostics, and intervention.

## 1) Skill code mapping rules

- **Primary skill code** = the *single* skill most directly assessed.
- **Secondary skill codes** = supporting skills required to complete the question.
- If a question is genuinely cross-skill, still force one primary code (for analytics clarity).
- Keep codes in existing app format (`N1.x`, `N2.x`, `N3.x`, `N4.x`).

Decision test:
- If learner masters only one skill, which one most increases chance of success on this item? → primary.

## 2) Micro-skill tagging

Tag the hidden cognitive actions, not just surface topic.

Examples:
- `ROUNDING_RULE_SELECTION` vs `ROUNDING_EXECUTION`
- `OPERATION_SELECTION` vs `FORMAL_METHOD_EXECUTION`
- `REPRESENTATION_TRANSLATION` for word ↔ number line ↔ symbol shifts

Rule of thumb:
- 1–3 micro-skills for simple items
- 3–5 for multi-step items

## 3) Misconception tagging

Use misconception tags only when there is a plausible wrong route.

For each misconception include:
- `type` (controlled vocabulary)
- `diagnostic_signal` (what wrong answer/working pattern indicates it)
- optional `likely_cause`

Good example:
- type: `ROUNDING_THRESHOLD_ERROR`
- diagnostic_signal: "Rounds 3.45 to 3.4 at 1dp"

## 4) Variation pattern and sequence logic

Each question should sit in a progression sequence.

Track:
- `pattern_type` (how complexity changes)
- `position_in_sequence` (1..n)
- `sequence_size` (n)

Common progression moves:
1. Clean integers
2. Decimals
3. Negatives/boundary values
4. Contextual/multi-step application

## 5) Cognitive load level (1–5)

Use this scale consistently:

- **L1**: Single-step, low distraction, familiar numbers
- **L2**: Single-step with mild complexity (decimals/negatives/similar distractors)
- **L3**: Two-step or representation switch
- **L4**: Multi-step with strategic planning and multiple possible errors
- **L5**: High-complexity multi-step, dense context, high working-memory demand

Always include a short `justification`.

## 6) Marking compatibility

Prefer auto-markable where possible:
- `AUTO_EXACT` for exact numeric/string answers
- `AUTO_TOLERANCE` for rounded/estimated numeric responses
- `RUBRIC_REQUIRED` only where machine marking would be unreliable

## 7) Quality gates before import

A question is import-ready only when:
- Primary skill is unambiguous
- Micro-skills are specific (not generic)
- At least one misconception is listed (unless genuinely trivial)
- Variation position is coherent in its sequence
- Cognitive load has explicit rationale
- Marking fields are complete

## 8) Pilot workflow (recommended)

1. Map first 25 questions from Unit 1 Part A (Foundation).
2. Review for consistency and adjust vocab if needed.
3. Lock vocabulary.
4. Map remaining Unit 1 files in batches.

---

## Output files

- Schema: `docs/unit-mapping/UNIT1_MAPPING_SCHEMA.json`
- Template: `docs/unit-mapping/unit1-question-template.jsonl`
- (Optional) CSV export for manual editing + JSON transform script
