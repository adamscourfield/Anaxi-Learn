# Reward Economy Table (v1)

## XP and Token Rules
| Event | XP | Tokens | Notes |
|---|---:|---:|---|
| Diagnostic item correct | +5 | 0 | baseline effort reward |
| Diagnostic item incorrect (attempted) | +2 | 0 | effort-safe, prevents shutdown |
| Shadow item correct | +8 | 0 | mastery-relevant item |
| Route completed | +20 | 0 | session milestone |
| Skill -> Developing | +30 | +1 | key transition |
| Skill -> Secure | +60 | +2 | high-value mastery outcome |
| Retry recovery (fail -> pass) | +25 | +1 | resilience bonus |
| Streak day maintained | +15 | 0 | consistency |
| Weekly target hit | +80 | +3 | macro loop |

## Multipliers
- Accuracy >=85% in session: +10% XP session bonus
- 2+ secure transitions in session: +1 token bonus
- Guessing safeguard: if 3 rapid wrong guesses (<6s each), XP halved for next 5 questions

## Spend model (cosmetic only)
- Theme unlock: 6 tokens
- Avatar frame: 8 tokens
- Progress trail effect: 10 tokens
- Title badge tier: 12 tokens

## Progress tiers
- Tier 1: 0-199 XP
- Tier 2: 200-499 XP
- Tier 3: 500-899 XP
- Tier 4: 900-1499 XP
- Tier 5: 1500+

## Integrity constraints
- No token rewards for idle/session-abandon flows.
- Secure transition requires shadow validation pass.
- Token awards logged with event + reason.
