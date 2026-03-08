# UI Smoke Checklist (v1) — Learn + Diagnostic

Use this for a fast 20-30 min product sanity pass.

## Test setup
- Use 1 student account
- Use a subject with at least one skill and some items
- Keep browser console open for visible errors

---

## A) Learn flow (`/learn/[subjectSlug]`)

### A1. Subject page loads
- [ ] Subject title renders
- [ ] Skills list appears (or clear empty state)
- [ ] No layout overflow on mobile width

### A2. Start a skill session
- [ ] Intro card renders subject + skill name
- [ ] Start button enabled only when item count > 0
- [ ] If item count = 0, warning message appears and Start is disabled

### A3. Question interaction
- [ ] Progress indicator updates correctly (e.g. 1/5 -> 2/5)
- [ ] Option selection visually highlights chosen option
- [ ] Submit button disabled until an option is selected
- [ ] Submit button shows loading state while posting
- [ ] Rapid double-click doesn’t create duplicate transitions

### A4. Error handling
- [ ] If attempt API fails, user sees clear inline error message
- [ ] User can retry submit successfully after failure
- [ ] No crash if question has malformed/empty options (shows warning)

### A5. Results screen
- [ ] Session complete screen always renders
- [ ] Accuracy percentage is valid even edge case 0 items
- [ ] Correct/incorrect markers align with answered question count
- [ ] “Practice Again” and “Dashboard” buttons navigate correctly

---

## B) Diagnostic flow (`/diagnostic/[subjectSlug]`)

### B1. Entry and resume
- [ ] Diagnostic start page loads without error
- [ ] Existing in-progress session resumes correctly
- [ ] New session starts when none in progress

### B2. Question loop
- [ ] One diagnostic item shown at a time
- [ ] Submitting response moves to next item
- [ ] Item counter increments
- [ ] No duplicate submissions on rapid clicks

### B3. Completion
- [ ] Completion page renders summary
- [ ] Session status marked completed
- [ ] Skill mastery initialization happens (no visible error)

---

## C) UX quality checks (secondary-friendly)

- [ ] Visual style feels clean/non-childish
- [ ] Feedback appears quickly (<300ms perceived)
- [ ] Button labels are clear and action-oriented
- [ ] No clutter or competing calls-to-action
- [ ] Keyboard focus states visible for accessibility

---

## D) Basic telemetry checks

- [ ] attempt_submitted events emitted
- [ ] attempt_graded events emitted
- [ ] diagnostic_completed event emitted
- [ ] No obvious payload omissions (skillId/subjectId/itemId)

---

## E) Stop-ship issues
If any occur, pause pilot:
- [ ] Blank/blocked screen in core flow
- [ ] Submit does nothing with no user feedback
- [ ] Wrong navigation loop (cannot exit/recover)
- [ ] Results mismatch (count/score inconsistent)
- [ ] Severe mobile rendering break

---

## Pass criteria for this smoke round
- All A1-A5 pass
- All B1-B3 pass
- No stop-ship issue triggered

If pass: proceed to mini pilot.
If fail: patch and rerun this same checklist.