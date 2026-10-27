# 0007. Berserker AI scoring and its first-mover weakness

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M2

## Context

Spec §10 gives the AI scoring formula with five weights. M2 needs only the berserker preset.

## Decision

- Only `berserker` exists, with weights for damage, kills and healing. Damage to the AI's own side counts double against a plan. Danger and objective terms arrive with the presets that need them.
- With nothing in reach, the AI walks to the reachable tile closest (by walking distance) to any foe.

## Consequences

- Planning takes under 10ms on the 12×12 meadow.
- **Known weakness:** when two berserker sides meet, the side that walks into range first usually loses. In 100 AI-vs-AI meadow battles the side moving second won 97–100% of the time, regardless of spawn side or team makeup. A human player can exploit this by holding position. The "danger at tile" term should fix it when added.
- Code: `src/rules/ai.ts`.
