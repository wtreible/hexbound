# 0013. Ignite combo rules

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

Spec §6.6: "A Grenadier or Mage fire ability hits a Saboteur's oil tile → the oil explodes in a radius-2 AoE and leaves burning terrain for 2 rounds", and combos only trigger between units controlled by different players. Networking is deferred (decision 0008).

## Decision

- Combos are `kind: 'combo'` abilities with a `trigger`. Ignite's is `element-on-hazard` (fire on oil, cross-player).
- It triggers when **any** ability with a fire-element damage effect has an oil tile in its area, and that oil was laid by a **different human player** than the caster. Enemy-laid oil and the caster's own oil don't trigger it.
- The explosion is centred on the first matching oil tile, once per ability. It deals `mag × 1.0` fire damage to every unit within 2 tiles, friend or foe, and leaves fire on those tiles for 2 rounds.
- Hot-seat testing: the M4 test squad alternates units between `p1` and `p2`.

## Consequences

- The UI shows the combo with a banner, not yet with the planning-preview link icon (§6.6), which arrives with simultaneous planning in M3.
- Code: the combo loop at the end of `resolveAbility` in `src/rules/abilities.ts`.
