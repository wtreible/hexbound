# 0004. CT carry, phase order and status timing

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M2

## Context

Spec §5.2 says waiting "leaves more CT for the next turn (`ct` carries over 60, or 80 if the unit didn't move or act)". It doesn't say what happens after a full turn, whether overflow above 100 is kept, which phase goes first when both sides are ready on the same tick, or when statuses expire.

## Decision

- **CT carry:** after a turn, `ct` is set to 0 if the unit both moved and acted, 60 if it did one, 80 if it did neither. Overflow above 100 is dropped, so a unit can't be ready again without the clock ticking.
- **Phase order:** when player and enemy units become ready on the same tick, the player phase runs first; the enemy phase then runs without further ticks. Within a phase, units are ordered by CT (highest first), then id.
- **Statuses** lose a turn when their unit's turn starts and expire at 0.

## Consequences

- Dropping overflow prevents one side starving the other of turns.
- Players acting first on ties feeds the first-mover effect in 0007.
- Code: `src/rules/turn.ts` (`CT_CARRY`, `advance`, `endTurn`).
