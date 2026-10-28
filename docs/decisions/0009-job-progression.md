# 0009. Job progression: ranks, unlocks and the camp test harness

- **Status:** Superseded by 0023
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

Spec §6.1–6.2 sets JP amounts and rank thresholds but not what each rank unlocks for passives and ultimates, how hybrids' four abilities are spread across ranks, or how to change jobs before the run's Camp node exists (M5).

## Decision

- **Rank thresholds:** Rank 1 at 60 JP, Rank 2 at 150, mastered (Rank 3) at 300, cumulative per job.
- **Base jobs** unlock their three actions at Ranks 0/1/2. **Hybrids** unlock two actions at Rank 0, then one each at Ranks 1 and 2.
- **Passive:** a job's passive is learned at Rank 2 and can then be equipped on any job. **Ultimate:** granted on mastery, equippable on any job.
- **Secondary:** any other job at Rank 1+; only its unlocked actions are usable.
- **JP:** 8–12 (rolled) to the current job per action taken; +20 to every surviving player unit when the player side wins.
- **Job pool:** all six base jobs are available to every unit for now. The meta pool (§6.7: new profiles start with three) arrives with meta progression in M7. Hybrids unlock per unit when both parents are mastered.
- **Between battles:** a camp screen (`src/ui/camp.ts`) is the M4 test harness: change job, secondary, passive and ultimate, plus a **debug +100 JP** button. Units start each battle at full HP/MP with no statuses or Resolve. Downed units pull through; dead units are gone. If the whole squad dies, a fresh squad is recruited.
- **Primary actions above the unit's rank** are shown greyed out with the rank they need, so progression is visible. Secondary actions show only unlocked ones.

## Consequences

- The camp screen is replaced by the run's Camp node in M5; `setLoadout` validation stays.
- **JP pacing is not yet verified against the §6.2 target** (master a job in about 3 battles). In AI-vs-AI simulations, units act only once or twice before one side collapses (about 10–20 JP each in a loss). The one simulated win gave survivors about 80 JP from about 5.5 actions each. That suggests 4+ battles per mastery, but AI-vs-AI play isn't representative of a human player. Re-measure with real play, then tune `ACT_JP`, `CLEAR_BONUS_JP` or `RANK_JP`.
- Code: `src/rules/jobs.ts`, `src/rules/battle.ts` (`readyForBattle`, `survivors`), `src/ui/camp.ts`.
