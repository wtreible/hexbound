# 0014. Temporary quick 2v2 test battles on a half-size map

- **Status:** Temporary (playtesting aid; remove when no longer needed)
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

The camp → battle test loop used the full 4v4 meadow (12×12), so each playtest round took a while. This is a convenience for testing, **not a design change**: battles in the game are still the spec's 4-unit squads (§5.1).

## Decision

- While playtesting, the test loop runs **2v2** on **Little Glade** (`src/data/maps/glade.ts`), a 9×8 map: half the meadow's 144 tiles. "50% map" was read as half the area, not half of each side.
- The squad is the first two test units (Ada, Squire, slot `p1`; Bram, Archer, slot `p2`), so Ignite can still be tried hot-seat. Enemies are `banditPair` (one Squire, one Archer).
- Everything involved is marked `TEMPORARY (decision 0014)` in code.

## Consequences

- **To remove:** delete the marked block in `src/main.ts` (restore the meadow and full squad), `src/data/maps/glade.ts`, `banditPair` in `src/data/enemies.ts`, and the glade entry in `tests/data.test.ts`. Then mark this record Deprecated.
- Shorter battles give less JP per battle, so JP pacing (decision 0009) must be judged on full-size battles, not these.
- The 4v4 meadow stays for the automated full-battle tests.
