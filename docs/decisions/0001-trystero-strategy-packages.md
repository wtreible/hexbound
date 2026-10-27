# 0001. Trystero strategies as separate packages, chosen in one place

- **Status:** Accepted
- **Date:** 2026-10-27
- **Milestone:** M0

## Context

The spec (§3, §7.5) asks for Trystero with a signaling strategy that is easy to swap. Trystero 0.26 no longer ships `trystero/mqtt` or `trystero/torrent`; importing them throws a deprecation error. Each strategy is now its own `@trystero-p2p/*` package. The spec also flagged an assumption to verify: that the default strategy works from a `github.io` origin.

## Decision

- Depend on `trystero` (Nostr, the default) plus `@trystero-p2p/mqtt` and `@trystero-p2p/torrent` as fallbacks.
- `src/net/session.ts` is the only place a strategy is chosen. It loads the chosen package with a dynamic import, defaults to Nostr, and accepts `?strategy=mqtt|torrent` per page load.
- Messages go over a single Trystero action named `msg`, typed by `Msg` in `src/net/protocol.ts`.

## Consequences

- Verified on 2026-10-27: two tabs on `https://wtreible.github.io/hexbound/` connected and pinged over Nostr with no extra config. The fallbacks are untested.
- Unused strategies are code-split, so they don't add to the main bundle.
