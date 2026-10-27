# 0020. Enemies deal half damage and have half HP

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M5

## Context

After playtesting M5, the user found enemies too hard and asked for them to do 50% damage and have 50% of their default HP.

## Decision

- **Damage:** anything an enemy deals through the damage formula is ×0.5 (`ENEMY_DAMAGE_SCALE` in `src/rules/combat.ts`). That covers attacks, abilities, counters and combo explosions they set off. Flat board damage (poison, fire, traps and mines, which are percentages or fixed amounts) isn't scaled.
- **HP:** enemies get ×0.5 base HP (`ENEMY_HP_SCALE` in `src/rules/battle.ts`), on top of any boss scaling. A boss is therefore 2.5 × 0.5 = 1.25× the HP of a player unit of its job and level.
- The AI's danger estimate applies the same damage scale, so the player-side AI judges threats correctly.

## Consequences

- In 30 simulated full 4v4 runs with the AI on both sides, 29 were won (100% of battles), against 0 before. A human player should find the game much more forgiving. Re-tune these two constants (or per-act levels in `src/data/encounters.ts`) if it becomes too easy.
- Quick mode's own ×0.7 enemy handicap was removed (decision 0014).
