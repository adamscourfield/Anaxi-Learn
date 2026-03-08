# Instructional Quality Metrics (v1)

## Objective
Verify reteach content improves process understanding, not just click-through completion.

## Step-level metrics
1. Step completion rate
2. Step first-try success rate
3. Median retries per step
4. Hint exposure rate (hint1/hint2)
5. Median time per step

## Sequence-level metrics
1. Transfer check pass rate
2. Post-reteach shadow pass rate
3. Reduction in misconception-tag recurrence
4. Intervention flag rate after reteach

## Teaching quality thresholds (initial)
- Step first-try success: 55-80% target band
  - <55% too hard/confusing
  - >80% possibly too easy/low diagnostic value
- Transfer pass after reteach: >=70%
- Post-reteach shadow pair pass: >=65%
- Hint2 usage: <25%

## Alert rules
- Any step with >40% incorrect on first try for 2+ days -> content review
- Any step with median duration >20s and low pass -> simplify instruction/visual
- Transfer pass <60% for a route -> rework that route sequence

## Experiment method
A/B test step variants by:
- visual style
- instruction wording
- hint strategy
- action type

Use same skill + misconception segment for fair comparison.

## Dashboard views needed
1. Step hotspot table (fail/retry/time)
2. Route quality panel (transfer + shadow outcomes)
3. Misconception recurrence trend (before vs after reteach)

## Decision gate
A reteach sequence is “instructionally viable” when:
- transfer + shadow outcomes meet threshold,
- intervention rate does not increase,
- learners complete sequence without churn spike.
