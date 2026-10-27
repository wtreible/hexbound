# 0018. Rounds, and 3 full rounds before a downed unit is lost

- **Status:** Accepted (supersedes the downed-countdown rule in 0006 and the round definition in 0011)
- **Date:** 2026-10-27
- **Milestone:** M5

## Context

The user asked for downed units to get **3 full rounds** before they're lost for good. At first the countdown ticked on the downed unit's own would-be turns (0006). Then hazards (0011) and the countdown used "each player phase starts a round". With the CT timeline, player units often get separate phases, so "rounds" flew by: in a traced battle an archer went from downed to dead in about six turns.

## Decision

- **A round** lasts until every unit that was standing when it began has taken a turn (or gone down). Then the next round starts (`GameState.round`).
- **Downed units** start with 3. At each round start they lose one, and a unit whose counter is already 0 when a round starts becomes a grave. So a unit downed in round N can still be revived during the rest of N and during N+1, N+2 and N+3. It's lost as N+4 begins. The UI counts the current round too ("4 rounds to revive" right after going down, "last round" at 0).
- Hazards also age by these rounds, and Hold counts them.

## Consequences

- Rounds are slower and more predictable than phases; a fast unit may act twice in one round.
- Code: `advance` in `src/rules/turn.ts` (`tickDowned`, `tickHazards`, `roundStart`).
