# 0006. Downed units, knockback and the M2 effect set

- **Status:** Accepted; the downed countdown is superseded by 0018
- **Date:** 2026-10-27
- **Milestone:** M2

## Context

The spec gives downed units a "3-turn counter" without saying whose turns count, doesn't define knockback blocking, and lists effect types in §8 without saying which are needed first.

## Decision

- **Downed:** the 3-turn counter ticks each time the downed unit's CT would make it ready. At 0 the unit dies and becomes a grave. Downed units can't be damaged, healed or given statuses; only `revive` affects them. Rout ends when one side has no standing (non-downed) units.
- **Knockback** moves the target straight away from the attacker and stops at the board edge, water, any unit, or any higher tile. Drops of any height are allowed, with no fall damage yet.
- **Jobs** get an `attack` field: their basic attack, always usable.
- **Effects in M2:** `damage`, `heal`, `status`, `push`, `revive`, and `cleanse` (new: removes all statuses). `terrain`, `ct` and `summon` are added when an ability needs them.
- **Deferred:** line of sight (the `los` flag is ignored), charge-time spells (M5), MP regeneration, and rank gating (M4; until then every ability in a job's action set is usable).

## Consequences

- Graves are kept in state (`dead: true`) for M5's grave looting.
- Code: `src/rules/abilities.ts`, `src/rules/turn.ts`.
