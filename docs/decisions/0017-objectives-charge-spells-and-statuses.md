# 0017. Objectives, charge-time spells and more statuses

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M5 (stage 3)

## Context

Spec §5.2 names five objectives without rules. §5.3 describes charge-time spells that resolve on tiles. M5 asks for "the rest of the status effects", which the spec doesn't list.

## Decision

**Objectives** (`src/rules/objectives.ts`). Routing the enemy always wins. Losing means no squad unit is standing, unless some escaped.
- **Rout:** defeat every enemy.
- **Leader:** down the marked enemy (the first in the encounter). Every boss fight is a Leader fight.
- **Escort:** a level-matched **Pilgrim** (Chemist, `ownerId: 'npc'`) starts at the map's `vip` tile and must reach an exit. It's AI-controlled (the escort preset) and isn't in the squad. Losing it loses the battle.
- **Hold:** at each round start, if only player units stand on the map's hold tiles, a round is counted. Four counted rounds (not necessarily in a row) win.
- **Escape:** a squad unit that ends a move on an exit leaves the battlefield. Once no squad unit is left standing on the board and at least one escaped, the battle is won. Downed units left behind are carried out and survive at 1 HP.
- Battle maps carry `exits`, `hold` and `vip` markers. Encounters pick their objective. The temporary quick mode (decision 0014) turns Escort, Hold and Escape into Rout, since its small map has no markers.

**Charge-time spells:** an ability with `chargeTicks` is paid for and aimed when used. Its area is fixed from the caster's tile at that moment. It resolves after that many clock ticks on whatever is then on those tiles, so units can walk out. If the caster isn't standing then, it fizzles. Meteor (8), Rain of Arrows (6), Scorched Earth (6) and Stasis (5) charge. A unit that only acts keeps 60 CT and may act again before an 8-tick cast lands.

**New statuses:**
- `blind`: −40 to physical hit chance.
- `silence`: no `magic` abilities.
- `regen`: +10% of max HP at turn start.

Poison Cloud may blind, Smite may silence, and Sanctuary grants Regen.

## Consequences

- The UI marks exits (green), the hold ground (gold) and pending cast areas (purple), lists casts in the turn order, and states the objective there.
- The enemy AI ignores objectives (it just fights); the escort preset walks toward exits.
- Code: `src/rules/objectives.ts`, `src/rules/turn.ts` (`resolveCast`), `src/rules/reducer.ts` (`beginCast`, escaping).
