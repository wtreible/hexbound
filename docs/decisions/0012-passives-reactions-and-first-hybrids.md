# 0012. Passives, reactions and the first hybrid kits

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

Spec §6.3–6.4 names each job's passive and identity but not the rules for reactions, nor the hybrids' exact abilities.

## Decision

- **Passives are data** (`passive: PassiveEffect[]` on a `kind: 'passive'` ability): `stat` (Fleet, Pathfinder, Foresight, Elusive), `range` by tag (Eagle Eye: bows +1; Throw Range: thrown +2), `heal-boost` (Grace +20%), `mp-regen` (Mana Well), `mp-on-hit` (Arcane Edge), `counter`, `cover`.
- **Counter:** when a single target is damaged by an ability tagged `melee` from an adjacent attacker, it hits back with its basic attack (with its own hit roll).
- **Cover:** a single-target hostile ability aimed at a unit with an adjacent standing ally that has Cover hits that ally instead.
- **Steal** takes up to 6 MP until items exist (shop, M5).
- **First hybrids** (`src/data/abilities.ts`, `src/data/jobs.ts`) follow the §6.4 identities, with these simplifications:
  - Oracle drains and grants CT (Delay, Quicken, Stasis) instead of a Stop status.
  - Ranger has traps but no overwatch shots yet.
  - Spellblade spends MP on elemental strikes rather than draining MP for scaling damage; Drain Blade steals MP.
- **New ability fields:** `affects: 'all' | 'foes' | 'allies'` (default `all`, i.e. friendly fire); damage options `facingMultiplier` (Backstab) and `forceSide: 'back'` (Shadow Step, Deadeye); heal by `power`, `flat` or `pct`; effects `mp` and `ct`.

## Consequences

- Overwatch needs a movement reaction hook; add it when the Ranger kit is revisited (M7).
- Code: `src/rules/jobs.ts` (stats, range, healing), `src/rules/abilities.ts` (reactions).
