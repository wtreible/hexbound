# 0014. Temporary quick 2v2 test battles on a half-size map

- **Status:** Temporary (playtesting aid; remove when no longer needed)
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

The camp → battle test loop used the full 4v4 meadow (12×12), so each playtest round took a while. This is a convenience for testing, **not a design change**: battles in the game are still the spec's 4-unit squads (§5.1).

## Decision

- While playtesting, battles run **2v2** on **Little Glade** (`src/data/maps/glade.ts`), a 9×8 map: half the meadow's 144 tiles. "50% map" was read as half the area, not half of each side.
- Since M5 this is opt-in **turbo test mode** for checking progression and the run, not combat: add **`?quick`** to the URL.
  - Squad of 2. Every battle is a 2v2 on the glade: the encounter's first two enemies (a boss keeps its boss), with their HP, attack and defence ×0.7.
  - **The AI plays both sides**, using the cautious preset for the player's units, at **2× speed**. The result screen moves on by itself.
  - Why the ×0.7: in simulated quick runs without it, the AI-played pair won only 25% of battles and never left act 1. With it, they won 88%, and runs reach acts 2 and 3 (6 of 30 won outright). That's enough to exercise progression.
- Without `?quick`, runs use the real 4-unit squads and maps, and you control your units.
- Everything involved is marked `TEMPORARY (decision 0014)` in code.

## Consequences

- **To remove:** delete the marked `QUICK` block in `src/main.ts` (and its use in `go`), `src/data/maps/glade.ts`, and the glade entry in `tests/data.test.ts`. Then mark this record Deprecated.
- Shorter battles give less JP per battle, so JP pacing (decision 0009) must be judged on full-size battles, not these.
- The 4v4 meadow stays for the automated full-battle tests.
