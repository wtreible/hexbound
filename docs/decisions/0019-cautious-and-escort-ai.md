# 0019. Cautious and escort AI presets, and auto-play

- **Status:** Accepted (extends 0007)
- **Date:** 2026-10-27
- **Milestone:** M5

## Context

The user wanted the quick test mode to play itself. The berserker AI playing the player's side lost every simulated run in act 1 (its first-mover weakness, 0007), which would make auto-play useless for testing progression.

## Decision

- The planner scores every reachable tile: standing there, and acting from it with each ability on each target. One weighted sum covers damage, kills, healing, revives, **danger at the tile** (the hardest hit each foe could land there next turn, summed over foes; spec §10), and walking distance to foes and to goal tiles.
- **Presets:**
  - `berserker` (enemies): unchanged behaviour.
  - `cautious` (the player's units under AI control, as the spec's "cautious ally"): waits out of reach, lets foes come, heals and revives.
  - `escort` (the escorted NPC): heads for the exits and stays safe.
- Quick mode plays the player's side with `cautious` at 2× speed.

## Consequences

- In simulation the cautious side won about 60% of first battles against the berserker (it was 0% before). Full 4v4 runs still rarely got past act 1 with AI on both sides, so balance has to come from human playtests.
- Danger is computed per unit per turn and ignores height and facing. It's the costliest part of planning, but well under the 50ms budget on 12×12 maps.
- Code: `src/rules/ai.ts`.
