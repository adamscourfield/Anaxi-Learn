# Animation Cue Sheet (v1)

## Style direction
- Fast, clean, modern UI motion
- 150-450ms primary animations
- Avoid childish mascot-driven effects

## Event animation map
1. **Question correct**
   - Effect: small green pulse + XP float (+5)
   - Duration: 220ms
2. **Question incorrect**
   - Effect: subtle red shake (low amplitude) + "Try next step" prompt fade
   - Duration: 260ms
3. **Route completed**
   - Effect: progress ring sweep + chest pop
   - Duration: 380ms
4. **Shadow pair passed**
   - Effect: dual checkmark draw animation
   - Duration: 300ms
5. **Not Yet -> Developing**
   - Effect: card glow transition + rank bar jump
   - Duration: 420ms
6. **Developing -> Secure**
   - Effect: controlled confetti burst + token spin-in
   - Duration: 450ms
7. **Streak extended**
   - Effect: flame icon ignite + count ticker
   - Duration: 280ms
8. **Intervention flag**
   - Effect: neutral amber banner slide + calm icon
   - Duration: 240ms

## Accessibility controls
- Reduced motion mode: replace with fades only.
- Disable particles on low-performance devices.
- Color + icon redundancy for all status changes.
