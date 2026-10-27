# 0005. Hit chance and damage formulas

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M2

## Context

Spec §5.3 gives `damage = max(1, round((atk_or_mag * power) - def_or_res) * modifiers)` (the parentheses are ambiguous) and says evasion "is modified by facing" without a formula.

## Decision

- **Hit chance:** physical = `clamp(90 + facing hit bonus − target evade, 5, 100)`. Magic and non-hostile abilities always land. One roll per target decides all of that ability's effects on it; status effects then roll their own `chance`.
- **Damage:** `max(1, round((stat * power − defence) * (1 + height bonus) * (1 + facing bonus)))`, with `def` against `atk` effects and `res` against `mag`. Height bonus is +10% per tier above the target, capped at +30%, and never negative.
- **Facing side** is judged on the dominant axis from target to attacker; exact diagonals count as side.

## Consequences

- With base evade 5, side and back attacks hit 100%, so facing mostly matters for damage. Revisit when higher-evade jobs (Thief) arrive.
- Code: `src/rules/combat.ts`.
