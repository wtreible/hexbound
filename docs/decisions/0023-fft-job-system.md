# 0023. FFT-style job system: learn abilities with JP, a job tree, four ability slots

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M7

## Context

The spec (§6.4–6.5) planned a hybrid for every pair of base jobs (15) plus 4 prestige classes, unlocked by mastering parents through 3 ranks (decision 0009). The user asked for FFT's job system instead: not every combination needs its own class, and abilities should be bought with JP. They chose "spend JP per ability" and "an FFT-style tree, with advanced jobs requiring job levels".

## Decision

- **Learning:** every job lists abilities with JP prices (50–600). At camp a unit spends that job's unspent JP to learn one. Learned abilities are permanent. New units know their job's first action.
- **Job level** comes from total JP earned in a job (thresholds 100/250/450/700/1000/1400/1900, Lv 1–8), so spending never lowers it. **Mastered** = every ability in the job learned.
- **Slots:** primary job (its learned actions), secondary (another job's learned actions), reaction, support, movement and ultimate, each holding one learned ability of that kind. The old single passive slot is gone; former passives were sorted into reaction (Counter, Cover, Foresight, Elusive), support (Eagle Eye, Mana Well, Grace, Throw Range, Arcane Edge) and movement (Fleet, Pathfinder).
- **Tree:** 6 starting jobs, 10 advanced (Paladin, Spellblade, Oracle, Ranger, Saboteur, Dragoon, Monk, Hexer, Grenadier, Seer) and 3 master jobs (Templar, Chronomancer, Runeknight), each opened by job levels (DESIGN §6.3). About 60 new abilities.
- **JP:** acting gives 10–16 (was 8–12) and clearing a battle 30 (was 20), since a job now has 6–9 abilities to buy instead of 3 ranks.
- **Changing job keeps current HP** (capped at the new maximum) and refills MP. It used to refill HP, which with HP carrying over between battles made a job swap a free full heal at every camp.
- **New statuses and effects** to give the new jobs something to do: Airborne (Dragoon Jump; untargetable until the jump lands), Mark (+30 to be hit), Weaken/Empower (−/+25% damage dealt), Protect/Shell (−25% physical/magic damage taken), Focus (+20 hit), Dispel (strips helpful statuses), Summon, and the Rune hazard (empowers allies who start a turn on it). Support passives JP Boost and damage boosts; Auto-Mend/Auto-Potion reactions heal back part of a hit.
- **Enemies** use tier 0 jobs that know every ability. Enemies in player jobs know what their level could have bought (50 + 50 × level JP worth), never ultimates.

## Consequences

- Supersedes decision 0009 (ranks) and the hybrid kits in 0012, and DESIGN §6.4–6.5.
- Camp has a Learn panel per unit (pick a job, buy abilities) and lists locked jobs with what they need. The action menu and battle popups show job level instead of rank.
- Runs saved before this change are discarded (`RUN_VERSION` 3).
- Code: `src/rules/jobs.ts`, `src/data/jobs.ts`, `src/data/abilities.ts`, `src/ui/camp.ts`.
