# Anaxi Learn Gamification System Spec (v1)

## Objective
Increase sustained engagement for secondary learners **without diluting mastery quality**.

## Design principles
1. Mastery-first: reward improvement and secure understanding, not rapid guessing.
2. Secondary-appropriate tone: clean, sharp, non-childish visuals.
3. Motivation layers: instant feedback + session goals + weekly progression.
4. Recovery-positive: explicit rewards for correction after mistakes.

## Core loop
1. Student answers item.
2. System gives immediate accuracy + strategy feedback.
3. XP/token/streak update shown with light animation.
4. Student completes route and shadow checks.
5. Skill status changes (Not Yet -> Developing -> Secure) triggers milestone animation + reward.

## Reward currencies
- **XP**: fast progress signal for effort and completion.
- **Mastery Tokens**: high-value rewards for secure outcomes and resilience.
- **Streak**: consistency mechanic (daily/weekly).

## Progression layers
- **Micro** (per question): XP pulse + confidence meter shift.
- **Session** (5-15 min): route complete milestone + mini chest.
- **Weekly**: personal target completion and cosmetic unlock.

## Anti-boredom mechanics
- Choice nodes (pick between 2 equivalent next tasks)
- Skill quests (3-5 item objective cards)
- Boss check after 3 micro-skills
- Comeback bonuses for successful retries

## Guardrails
- No pure leaderboard pressure as primary motivation.
- Reward secure mastery more than volume.
- Guess-detection cooldown (reduce rewards on rapid random attempts).
- Teacher controls to disable cosmetic intensity.

## Event hooks (for product + analytics)
- question_answered
- route_completed
- shadow_pair_passed
- shadow_pair_failed
- skill_status_changed
- intervention_flagged
- streak_extended
- weekly_target_hit

## MVP scope
Implement for Y7 N1.1 first, then clone pattern to N1.2+ once stable.
