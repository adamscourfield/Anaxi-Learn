# ADR-001: Learning Module Boundaries

Date: 2026-03-10
Status: Accepted

## Context
Anaxi Learn has grown rapidly across diagnostic flow, learning progression, and knowledge-state updates. Clear boundaries are required to reduce coupling and regression risk.

## Decision
Define module responsibilities as follows:

- `src/features/diagnostic/*`
  - Owns diagnostic session flow and question selection.
  - Produces evidence events (attempts/outcomes), but does not directly manage long-term mastery policy.

- `src/features/learn/*`
  - Owns reteach/retest session orchestration.
  - Consumes knowledge-state outputs and route assignment decisions.

- `src/features/knowledge-state/*`
  - Owns mastery state transitions and derived indicators.
  - Is the canonical domain for confidence/mastery status calculations.

## Write policy
- Cross-module DB writes should go through explicit service functions, not ad-hoc direct writes from pages/routes.
- Validation and normalization rules (item type, explanation step integrity) must be enforced at write-time where feasible and always in CI.

## Consequences
- Better separation of concerns.
- Easier testing and safer refactors.
- Slightly more upfront structure for new features.
