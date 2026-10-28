# 0024. Meta progression: starting jobs, Codex, relics and shrine unlocks

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M7

## Context

DESIGN §6.7 lists the unlocks but not when they're recorded, what the relics are, or how shrine events are gated.

## Decision

- **Profile** (`localStorage['hexbound:profile']`, versioned, every access wrapped): starting jobs, jobs seen, jobs mastered, bosses beaten, furthest act, runs finished and runs won. Pure logic in `src/rules/profile.ts`, storage in `src/profile.ts`.
- **Recorded after every step**, not only at the end, so an abandoned run still counts what it found. Runs and wins are counted once, when the run ends.
- **Starting jobs:** Squire, Archer, Acolyte. Mastering a tier 1 job (learning all its abilities) in any run adds it to the draft.
- **Codex:** a job's entry (description, abilities, prices) opens once any unit has held it or met its requirements. Unseen jobs show only what opens them.
- **Starting relics**, one chosen at the draft: Traveler's Pack (+2 Potions, free); Coin Purse (+60 gold, finish a run); Smith's Whetstone (a tier 1 weapon, beat the act 1 boss); Phoenix Charm (a Phoenix Feather, reach act 3); Scholar's Tome (each unit also knows its job's second action, master an advanced job); Veteran's Banner (squad starts at level 2, win a run). They widen options more than they add power.
- **Shrine events** gain an optional `unlock`: Wandering Master opens after the first finished run, The Hexstone after the first win. The run stores its allowed pool at the start.
- The results screen lists what the run unlocked.

## Consequences

- Multiplayer (M3) will need each player's own profile to limit their draft (§6.7); the profile is already per-browser.
- Relic and shrine data are in `src/data/relics.ts` and `src/data/shrines.ts`; adding one needs no engine change unless it has a new effect type.
