# Hexbound Company

Co-op tactics roguelike in the browser, hosted on GitHub Pages. **Read `DESIGN.md` first** — it's the source of truth. Work through its §12 milestones in order; keep the doc updated when a decision changes.

## Commands
- `npm run dev` — local dev server (open two tabs to test multiplayer)
- `npm test` — Vitest, run before every commit
- `npm run build` — typecheck + production build into `dist/`
- `npm run typecheck`

## Layout rules
- `src/rules/` is pure game logic: no DOM, Three.js or network imports. Must be testable in Node.
- `src/data/` is data only. New jobs/abilities/enemies/combos must not need engine changes; extend the effect pipeline in `rules/` first if they do.
- Game state is plain serializable objects, no classes.
- Randomness only via `rules/rng.ts` (seeded), never `Math.random()` in rules.
- Trystero signaling strategy is chosen in one place: `src/net/session.ts` (override with `?strategy=mqtt|torrent`).
- `vite.config.ts` `base` must match the repo name for Pages.

## Assets
Every third-party asset gets a line in `CREDITS.md` in the same commit. CC0 preferred, CC-BY with attribution. No Square Enix-derived assets or FFT-unique terms.
