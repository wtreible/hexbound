# 0026. Tiles in front of the camera turn see-through

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M7

## Context

Maps like Hollow Caves have walls nine tiers tall. From most camera angles they hid the units and floor behind them, so the board couldn't be read without rotating. The spec (§9.1) says nothing about occlusion.

## Decision

- A tile fades to 25% opacity when it hides the point 0.4 above another tile's top, roughly where a unit standing there would be. A one-tier step never hides that point; a two-tier step hides the tile right behind it.
- The camera is orthographic, so the check (one ray per tile against all tiles) only re-runs when the view direction changes, not every frame.
- Clicks pass through faded tiles to the first solid tile behind them.
- Only the battle board fades; the menu diorama doesn't.

## Consequences

- Thick walls stack several faded layers and still darken the floor behind them a little. Lower `FADED_OPACITY` in `src/render/board.ts` if that reads as murky.
