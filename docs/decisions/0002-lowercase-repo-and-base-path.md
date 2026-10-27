# 0002. Lowercase repo name and Pages base path

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M0

## Context

The repo was created as `wtreible/Hexbound`. GitHub Pages serves a project site at the repo name with its exact case (checked: `/untitled-disc-game/` → 200, `/Untitled-Disc-Game/` → 404), and the Vite dev server is case-sensitive too. We wanted lowercase URLs.

## Decision

Rename the repo to `wtreible/hexbound` and use `base: '/hexbound/'` in `vite.config.ts`. The game's title stays "Hexbound".

## Consequences

- Live URL: `https://wtreible.github.io/hexbound/`. Dev URL: `http://localhost:5173/hexbound/`.
- GitHub redirects git operations from the old name; Pages does not redirect, but nothing had been deployed under the old name.
- If the repo is ever renamed again, `base` must change with it.
