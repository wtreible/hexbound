# 0010. Resolve and ultimates

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

Spec §6.1 says the Resolve meter "fills as the unit takes or deals damage" and powers ultimates, with no numbers.

## Decision

- Resolve runs 0–100. On every hit, **both** attacker and victim gain `ceil(50 × damage / victim's max HP)`. Flat board damage (poison, fire, traps) gives none.
- Every ultimate costs 100 Resolve. A unit equips one ultimate (from any mastered job).
- Resolve resets to 0 at the start of each battle.

## Consequences

- In AI-vs-AI simulations about 22% of player units reached 100 Resolve during a battle. So ultimates are occasional, late-battle moves. Raise the gain if they should come up more often.
- Ultimates are `kind: 'ultimate'` abilities with `cost: { resolve: 100 }` and go through the normal effect pipeline.
- Code: `resolveGain` in `src/rules/abilities.ts`.
