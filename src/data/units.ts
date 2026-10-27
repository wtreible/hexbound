import type { Stat } from '../rules/types';

// M1 placeholder roster for hot-seat testing. Different move/jump values make
// the reach rules visible on the board. Replaced by job-derived stats in M2.
export type RosterEntry = { name: string; ownerId: string; stats: Partial<Record<Stat, number>> };

export const DEFAULT_STATS: Record<Stat, number> = {
  hp: 30, mp: 10, atk: 5, mag: 5, def: 2, res: 2, spd: 6, move: 4, jump: 1, evade: 5,
};

export const placeholderRoster: RosterEntry[] = [
  { name: 'Ada', ownerId: 'p1', stats: { move: 4, jump: 1 } },
  { name: 'Bram', ownerId: 'p1', stats: { move: 3, jump: 3 } },
  { name: 'Cyril', ownerId: 'p2', stats: { move: 5, jump: 1 } },
  { name: 'Dena', ownerId: 'p2', stats: { move: 3, jump: 2 } },
];
