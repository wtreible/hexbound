# 0015. Run structure, levelling and HP between battles

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M5 (stage 1)

## Context

Spec §5.1 sketches the run (≈12 nodes, 3 acts, Camp heals 50%) and §5.4 mentions growth tables, but there's no XP system and nothing says whether HP persists. The user chose: **HP carries over** and **+1 level per battle won**.

## Decision

- **Map:** each act has 3 rows of 2–3 choice nodes, then a boss, so a run visits 12 nodes. Each node links to the nearest one or two in the next row, and every node is reachable. Act 1's first row is all battles. Each act's last choice row always offers a Camp.
- **Node weights:** battle 50, elite 15, camp 15, recruit 12. Shop and shrine come in M5 stage 2.
- **HP carries over** between battles (capped at the current max). MP refills, and CT, statuses and Resolve reset at each battle start. Units downed at the end of a won battle survive at 1 HP. **Camp rest** heals half of max HP, once per visit. Job and loadout changes also happen at camp.
- **Levels:** every surviving unit gains one level per battle won, growing by its **current** job's growth table (fractions accumulate in base stats). Current HP/MP rise by however much their maximums grew.
- **Enemies:** encounters per act in `src/data/encounters.ts`, at level 1 / 4 / 7 by act, +1 for elites, +2 for bosses. Bosses also get `BOSS_SCALE` (×2.5 HP, a little more attack and defence). Each node's battle is seeded from the run seed and node id, so refreshing mid-battle replays the same fight.
- **Recruits:** 3 offers in random base jobs at the squad's average level − 1 (minimum 1); take one if there's room. The squad is capped at 4.
- **Losing** a battle ends the run. **Winning** the act 3 boss wins it.
- **Autosave:** `localStorage['hexbound:run']` after every node and battle, with `RUN_VERSION`; mismatched saves are discarded. The title screen offers Continue or New run.
- **Solo draft:** pick 4 base jobs and names. A per-unit player slot (p1/p2) stays as a hot-seat stand-in until M3.

## Consequences

- **Difficulty is unverified.** In 40 AI-played runs, none got past act 1, even with enemies given a turn head start. The AI playing the player side is known to be poor (decision 0007), so this needs human playtesting before tuning `ACT_LEVEL`, encounter sizes or `BOSS_SCALE`.
- Meta unlocks on run end arrive with M7.
- Code: `src/rules/run.ts`, `src/data/encounters.ts`, `src/data/maps/`, `src/save.ts`, `src/main.ts`.
