# 0011. Hazards, new statuses and traps

- **Status:** Accepted; the round definition is superseded by 0018
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

The M4 kits need oil (for Ignite), burning ground, traps and mines, plus slow, haste, smoke and poison. The spec's §8 sketch has a `terrain` effect with a `TerrainId`, but `TerrainId` already names a tile's ground type (grass, dirt...).

## Decision

- **Hazards** (`state.hazards`) are things left on tiles: `oil`, `fire`, `trap`, `mine`. The effect is `{ type: 'hazard' }` rather than the spec's `terrain`, to avoid clashing with tile terrain. One hazard per tile; a new one replaces the old. Traps and mines only go on empty tiles.
- **Rounds:** a round starts with each player phase. Hazards lose a round then and vanish at 0.
- **Fire** deals 15% of max HP to a unit standing on it when its turn starts. **Oil** does nothing by itself.
- **Traps and mines** trigger when a unit of the other side walks onto them: the unit stops on that tile, and the hazard is used up. Trap: 12 damage and pinned for 2 turns. Mine: 20 damage. The AI doesn't see traps.
- **New statuses:** `slow` (speed ×0.5), `haste` (speed ×1.5), `veil` (+30 evade), `poison` (10% of max HP at turn start).
- **Smoke** (Thief) and **Poison Cloud** (Saboteur) apply statuses to units in an area, rather than leaving a zone on the board. That's simpler, and close enough to "evade zone" and "zone denial" for now.
- **MP regeneration** exists only through Mana Well (+3 MP at turn start).

## Consequences

- Hazards render as tile markers (`setHazards` in `src/render/board.ts`).
- Revisit lasting smoke/poison zones if the statuses feel too weak.
- Code: `src/rules/abilities.ts` (`hurt`, `TRAP_EFFECTS`), `src/rules/turn.ts` (`turnStart`, `tickHazards`), `src/rules/reducer.ts` (trap stops).
