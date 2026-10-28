# 0022. Synthesized spell sounds and a UI that scales with the screen

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M7

## Context

Spell casts used Kenney interface clips (glass, maximize) that sounded like a metal bonk. Menus were sized in px and looked tiny on 1440p and 4K monitors.

## Decision

- **Spell sounds are synthesized** in `src/audio.ts` with Web Audio: `cast` (a rising shimmer), `spellHit` (a soft whump with a crackle) and `heal` (a three-note chime). Magic abilities play `cast` when acted and `spellHit` on their damage; physical hits keep the Kenney impacts. The unused glass and maximize clips were removed.
- **The UI is sized in rem** off `html { font-size: clamp(16px, calc(0.55vw + 0.55vh + 4px), 30px) }`: about 16px at 1280×800, 26px at 1440p and capped at 30px on 4K. Form controls inherit the font.
- **Menu skin:** gilt buttons, studded panels, keycap number badges, the battle HUD at top centre, and a slowly orbiting diorama of idle units behind every menu screen (`src/render/backdrop.ts`). Battles turn the diorama off.

## Consequences

- New CSS should use rem, not px, or it won't scale.
- Font choice is still open: candidate sheets are in `font-options/` for the user to pick from.
