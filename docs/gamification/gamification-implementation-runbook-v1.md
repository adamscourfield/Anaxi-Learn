# Gamification Implementation Runbook (v1)

## Goal
Ship gamification for N1.1 MVP that improves engagement **without weakening mastery quality**.

## Scope (v1)
- Y7 N1.1 only
- XP + Tokens + Streak
- Route/Shadow-linked rewards
- Basic animation cues
- Teacher visibility for engagement + intervention

## Source docs
- `gamification-system-spec-v1.md`
- `reward-economy-table-v1.md`
- `animation-cue-sheet-v1.md`
- `gamification-ui-and-teacher-view-v1.md`

---

## Build order

### Phase 1: Data + events
1. Add reward event constants:
   - question_answered
   - route_completed
   - shadow_pair_passed/failed
   - skill_status_changed
   - streak_extended
   - intervention_flagged
2. Extend event payload to capture:
   - xp_delta
   - token_delta
   - streak_delta
   - reason_code

**Acceptance:** every rewarded action creates a traceable event.

### Phase 2: Reward engine
1. Implement reward table from `reward-economy-table-v1.md`
2. Add safeguard logic:
   - rapid-guess detection
   - cooldown XP reduction
3. Add state updater for:
   - cumulative XP
   - token balance
   - current streak

**Acceptance:** deterministic reward output for identical input events.

### Phase 3: UI feedback layer
1. Add HUD (XP/streak/tokens)
2. Add event-triggered animations mapped in cue sheet
3. Add reduced-motion fallback

**Acceptance:** no blocking UI transitions; animation off mode fully usable.

### Phase 4: Teacher view
1. Add minimal engagement panel:
   - completion rate
   - route success by type
   - intervention count
2. Add student drilldown:
   - misconception profile
   - reward timeline

**Acceptance:** teacher can identify low-engagement and high-risk learners in <30s.

### Phase 5: N1.1 pilot
1. Run 10-20 student mini pilot
2. Compare against baseline:
   - completion rate
   - time on task
   - retries before success
   - secure transitions

**Acceptance gate:** engagement up, mastery outcomes non-negative.

---

## MVP acceptance tests

### Functional
- XP/token/streak update correctly on each event
- Rewards persist across sessions
- Wrong-answer effort reward does not exceed correct-answer reward
- Secure transition awards trigger only after shadow validation

### UX
- Feedback appears within 300ms after answer submit
- Animations never obscure question content
- Reduced-motion setting disables particles and transform effects

### Integrity
- Guess cooldown activates after rapid random wrong attempts
- No rewards on abandoned/incomplete actions
- Reward totals match event ledger

---

## Launch checklist
- [ ] Reward engine integrated
- [ ] HUD visible and stable
- [ ] Animations mapped + reduced-motion tested
- [ ] Teacher panel shows engagement + intervention
- [ ] Pilot metrics dashboard ready
- [ ] Rollback toggle prepared (gamification on/off)

---

## Pilot KPIs
- +15% session completion (target)
- +10% return rate in 7 days (target)
- No drop in shadow pass rate (must hold or improve)
- Intervention rate not materially worsened

---

## Post-pilot decision
- **Pass:** clone same architecture to N1.2
- **Fail:** adjust only one variable at a time:
  1) reward values
  2) animation intensity
  3) cooldown sensitivity

Keep mastery logic unchanged while tuning motivation layer.
