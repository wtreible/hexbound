# 0025. M7 before M3; new combos, enemies, AI presets and maps

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M7

## Context

The user asked to do M7 (content) before networking. M7 also needs three more cross-player combos, 12+ enemy types and 15+ maps, and the spec leaves the combos' exact rules open.

## Decision

- **Build order:** M0, M1, M2, M4, M5, M6, **M7, M3**. Updates decision 0008's order; its other points stand. Channel still waits for M3.
- **Pincer:** a player unit's hit on a foe that another player's unit hit this phase from the opposite side counts as from behind. Only the second hit is upgraded, since the first can't know a second is coming. Phase hits are tracked in `GameState.phaseHits` and reset each phase.
- **Aegis Link:** a holy heal on a unit next to another player's unit with Cover equipped heals that unit by the same amount. Tied to Cover (any job can equip it), not to the Paladin job.
- **Volley Mark:** a bow ability at a foe Marked by a different player skips the hit roll. The spec's "pierces to the next enemy" was dropped for now; Piercing Shot already covers piercing.
- **Enemies:** 13 enemy jobs (grunt, bone archer, necromancer, wraith, ghoul, bone golem, cult healer, shieldbearer, assassin, warlock, firecaller, sniper, hexed knight), plus advanced player jobs fielded as enemies in later acts. Every enemy job appears in an act 1–3 encounter; bosses are leader objectives.
- **AI presets** per enemy job: berserker, coward (keeps away, attacks when safe), healer, sniper and boss, each with a weight for landing statuses. `presetFor(unit)` picks enemies' preset from their job. In battle, enemies now use it (they were all berserkers).
- **No stalemates:** a unit that can't do anything useful from any reachable tile re-plans with approach at least 0.5 and a quarter of its danger weight. Without this, cautious player AI and wary enemies could wait out of reach forever (found by the run simulation test).
- **Maps:** 12 new templates, 15 in all, each checked by a test that every spawn can reach every other with jump 2.

## Consequences

- AI behaviour changed for every enemy: expect a balance pass.
- Code: combos in `src/rules/abilities.ts`, presets in `src/rules/ai.ts`, encounters in `src/data/encounters.ts`, maps in `src/data/maps/`.
