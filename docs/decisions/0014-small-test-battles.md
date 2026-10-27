# 0014. Temporary quick 2v2 test battles on a half-size map

- **Status:** Temporary (playtesting aid; remove when no longer needed)
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

The camp → battle test loop used the full 4v4 meadow (12×12), so each playtest round took a while. This is a convenience for testing, **not a design change**: battles in the game are still the spec's 4-unit squads (§5.1).

## Decision

- While playtesting, battles run **2v2** on **Little Glade** (`src/data/maps/glade.ts`), a 9×8 map: half the meadow's 144 tiles. "50% map" was read as half the area, not half of each side.
- Since M5 this is opt-in **turbo test mode** for checking progression and the run, not combat: add **`?quick`** to the URL.
  - Squad of 2. Every battle is a 2v2 on the glade: the encounter's first two enemies (a boss keeps its boss).
  - **The AI plays both sides**, using the cautious preset for the player's units, at **2× speed**. The result screen moves on by itself.
  - Quick mode briefly weakened enemies to ×0.7 as well. It was removed once enemies were halved for everyone (decision 0020): stacked, every simulated quick run was won, so losses and permadeath were never exercised. Without it, 20 of 30 simulated quick runs were won (96% of battles), with losses spread over acts 2–3.
- Without `?quick`, runs use the real 4-unit squads and maps, and you control your units.
- Everything involved is marked `TEMPORARY (decision 0014)` in code.

## Consequences

- **To remove:** delete the marked `QUICK` block in `src/main.ts` (and its use in `go`), `src/data/maps/glade.ts`, and the glade entry in `tests/data.test.ts`. Then mark this record Deprecated.
- Shorter battles give less JP per battle, so JP pacing (decision 0009) must be judged on full-size battles, not these.
- The 4v4 meadow stays for the automated full-battle tests.
