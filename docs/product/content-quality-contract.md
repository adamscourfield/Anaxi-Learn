# Content Quality Contract

This document defines non-negotiable quality rules for question banks, reteach models, and explanation checkpoints.

## 1) Item-level rules (machine-enforced)

1. **Answer-in-options (MCQ/TRUE_FALSE):** if options exist, `answer` must match one option (case-insensitive trimmed match).
2. **No duplicate options:** normalized options must be unique.
3. **Boolean typing:**
   - if options are `True/False` and answer is boolean-like, item type must be `TRUE_FALSE`.
   - otherwise use `MCQ` or appropriate type.
4. **Prompt non-empty:** question stem must be non-empty.
5. **Skill linking:** every imported item must link to at least one skill.

Primary checker: `npm run validate:items`

## 2) Explanation-step rules (machine-enforced)

1. `questionType` must be present on all explanation steps.
2. `checkpointQuestion` must be non-empty.
3. `checkpointOptions` must contain >= 2 options for MCQ-like steps.
4. `checkpointAnswer` must match one checkpoint option for MCQ-like steps.
5. Each explanation step should have at least one `stepInteraction`.

Primary checker: `npm run validate:explanations`

## 3) Route coverage rules (machine-enforced)

For each routed skill code in `NEXT_PUBLIC_ROUTED_SKILL_CODES`, explanation routes `A`, `B`, and `C` must exist and be active.

Primary checker: `npm run validate:learning`

## 4) Human QA rules (manual)

1. **Clarity:** stem can be understood by target year group without ambiguity.
2. **Misconception quality:** distractors reflect plausible misconceptions.
3. **Difficulty spread:** each skill has easy/medium/stretch coverage.
4. **Reteach usefulness:** model explanation is actionable, checkpoint tests the intended concept.
5. **No superficial repeats:** avoid near-identical stems unless deliberately varied by pedagogical pattern.

## 5) Operational policy

- New content packs must pass all machine checks before merge.
- Failing any rule blocks release readiness.
- Cleanup scripts are acceptable for migration; long-term state must satisfy this contract natively.

## 6) Quick commands

```bash
npm run validate:items
npm run validate:explanations
NEXT_PUBLIC_DEFAULT_SUBJECT_SLUG=ks3-maths NEXT_PUBLIC_ROUTED_SKILL_CODES=N1.1,N1.2,N1.3,N1.4,N1.5 npm run validate:learning
```
