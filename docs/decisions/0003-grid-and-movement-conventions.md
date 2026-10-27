# 0003. Grid, facing and movement conventions

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M1 (side rules extended in M2)

## Context

The spec describes height tiers and `move`/`jump` stats but not coordinates, facing values, whether `jump` limits drops, or how units block movement.

## Decision

- Grid coordinates are `{ x, y }`, stored row-major (`tiles[y * width + x]`). In world space, grid `y` maps to `z`.
- Facing: `0` north (−y), `1` east (+x), `2` south (+y), `3` west (−x). After a move, a unit faces along its last step.
- Movement is 4-directional BFS, one step per tile. A step is legal when both tiles are walkable and the height difference, **up or down**, is at most `jump` (in tiers). Water isn't walkable.
- Units can pass through allies but not stop on them, and cannot pass through enemies. Sides: all player slots are one side; `ownerId: 'enemy'` is the other. Downed units block like living ones; graves don't block.
- Map templates in `src/data/maps/` are rows of characters: `'0'`–`'9'` is height in tiers, `'~'` is water. Land terrain comes from height for now. Spawns are listed per side (`player`, `enemy`).

## Consequences

- Limiting drops by `jump` keeps cliffs meaningful both ways, like FFT. Knockback is the exception (see 0006).
- Code: `src/rules/grid.ts` (`reachable`, `canStep`, `pathTo`, `distanceMap`).
