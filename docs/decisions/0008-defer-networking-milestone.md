# 0008. Defer networking (M3) until after the art pass

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M4

## Context

M3's acceptance test needs two players on different networks finishing a battle on the live URL. We can't run that test yet. The rest of the game doesn't need the network: every state change already goes through `applyIntent`, so the host loop can be added later without reworking the rules.

## Decision

- **Build order:** M0, M1, M2, M4, M5, M6, **M3**, M7. Milestone numbers are kept so existing references stay valid.
- **Channel** (a cross-player combo) moves from M4 to M3. It's defined in terms of simultaneous planning ("an ally Mage who planned a spell this phase"), which is an M3 feature.
- **Ignite** stays in M4. It only needs units owned by different player slots, which hot-seat play can test by splitting the squad between `p1` and `p2`.
- **M5's acceptance test** becomes a full **solo** run that can be resumed after a refresh. The 2-player run moves into M3's acceptance test.

## Consequences

- Keep routing every state change through `applyIntent` and keep game state serializable, so M3 can slot in.
- M4–M6 are verified solo or hot-seat. Multiplayer-specific behaviour (simultaneous planning, AI takeover on disconnect, desync recovery, Channel) waits until M3.
- The M0 net smoke test stays in the UI until M3 replaces it with the real lobby.
