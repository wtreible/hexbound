# Hexbound Company

Co-op tactics roguelike in the browser, hosted on GitHub Pages. **Read `docs/DESIGN.md` first**: it's the source of truth. Work through its §12 milestones in the build order given there (M3 networking comes last; see `docs/decisions/0008` and `0025`). Keep the doc updated when a decision changes.

## Design decisions
Record every design decision in `docs/decisions/` as a numbered file (template and index in its README): anything the spec doesn't say, anything it says ambiguously that you had to interpret, and any change to it. Add the record in the same commit as the code it explains, and update `docs/DESIGN.md` if the spec itself changes.

## Commands
- `npm run dev` — local dev server (open two tabs to test multiplayer)
- `npm test` — Vitest, run before every commit
- `npm run build` — typecheck + production build into `dist/`
- `npm run typecheck`
- `npm run models -- <adventurers-dir> <skeletons-dir>`: rebuild `public/models/` from the KayKit packs (see `docs/decisions/0021`)

## Layout rules
- `src/rules/` is pure game logic: no DOM, Three.js or network imports. Must be testable in Node.
- `src/data/` is data only. New jobs/abilities/enemies/combos must not need engine changes; extend the effect pipeline in `rules/` first if they do.
- Game state is plain serializable objects, no classes.
- Randomness only via `rules/rng.ts` (seeded), never `Math.random()` in rules.
- Trystero signaling strategy is chosen in one place: `src/net/session.ts` (override with `?strategy=mqtt|torrent`).
- `vite.config.ts` `base` must match the repo name for Pages.

## Assets
Every third-party asset gets a line in `CREDITS.md` in the same commit. CC0 preferred, CC-BY with attribution. No Square Enix-derived assets or FFT-unique terms.
