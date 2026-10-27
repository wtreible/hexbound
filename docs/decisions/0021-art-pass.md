# 0021. Art pass: models, textures, sound and UI skin

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M6

## Context

M6 replaces placeholder capsules and flat colours with the look described in spec §9.1. Assets must be free (CC0 preferred) and credited, with each model ≤ 1.5 MB (§9.3).

## Decision

- **Characters:** KayKit Adventurers (player side) and KayKit Skeletons (enemies), both CC0, from the official GitHub repos. All share one rig and animation set.
  - `npm run models -- <adventurers-dir> <skeletons-dir>` (`scripts/build-models.mjs`) keeps the 12 clips the game plays and drops IK and rest-pose channels, then prunes and meshopt-compresses. That takes each model from 3.6–4.8 MB to about 300 KB (2.9 MB in all, weapons included). The source packs aren't committed; only the built files are.
  - `public/models/manifest.json` (as in §9.3) maps bodies and weapons to files and names the hand bones.
- **Job looks** (`src/data/looks.ts`): a body, which of its built-in props to show, weapons attached to the hand bones, and a tint. Hybrids use one parent's body with the other parent's gear (§9.2): for example, the Paladin is the Knight body with a badge shield and a holy tint, and the Ranger is the hooded Rogue with a crossbow. Enemies are skeletons by job type. The escorted Pilgrim is the Barbarian with a mug.
- **Animations:** idle, walk, attack (melee, shoot, cast, support or item, chosen by the ability's tags), hit, a death clip held while downed, and a cheer on victory.
- **Tiles:** pixel textures generated in code at startup (seeded, so stable). Speckled grass, dirt and stone tops, and banded earth sides that repeat per height tier. Water is translucent and scrolls. No tile assets were needed.
- **Sound:** Kenney CC0 effects (hits, swings, footsteps, magic, coins, UI) and two CC0 OpenGameArt tracks by RandomMind (exploration on menus, battle in fights). Music streams and starts after the first click, as browsers require. A Sound on/off toggle is remembered per browser.
- **UI:** Cinzel headings and Alegreya body text (OFL, self-hosted through Fontsource), parchment panels with a gold double border, and hand-drawn SVG map icons instead of emoji (emoji glyphs were missing on some systems). Units get a team-coloured disc, a floating job badge when selected, and model portraits in the command bar, camp and recruit screens.
- **Camera** pans smoothly to the unit being commanded or acting, so it's never hidden behind the command bar.
- **The M0 networking panel** is shown only with `?net` until the real lobby (M3).

## Consequences

- The two music files are 13 MB at 320 kbps. They're streamed, not preloaded, so they don't slow the first load. Re-encoding them smaller is a follow-up (no encoder was available here).
- With the model library unavailable, units fall back to the capsules.
- Screenshots for checking the art were taken with headless Chromium (software WebGL). Its missing system libraries were unpacked locally from Ubuntu packages; nothing was installed system-wide.
