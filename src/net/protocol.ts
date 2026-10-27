// Wire protocol (docs/DESIGN.md §7.4). Bump PROTOCOL_VERSION on any breaking change;
// clients with a mismatched version are told to refresh.
//
// M0 only carries hello + ping. The game messages (snapshot, plan, commit,
// events, ...) arrive in M3 once rules/types.ts defines GameState and Intent.

export const PROTOCOL_VERSION = 1;

export type Msg =
  | { t: 'hello'; v: number; profileId: string; name: string }
  | { t: 'ping'; n: number; sentAt: number };
