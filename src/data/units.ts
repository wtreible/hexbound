import type { Stat } from '../rules/types';

// Starting stats and the M2 test squad. The run's squad draft (M5) replaces
// the fixed squad; level-up growth arrives with jobs in M4.

export type RosterEntry = { name: string; job: string };

/** Level-1 base stats before job multipliers. move/jump are bonuses on top of the job's. */
export const BASE_STATS: Record<Stat, number> = {
  hp: 36, mp: 12, atk: 14, mag: 14, def: 4, res: 4, spd: 6, move: 0, jump: 0, evade: 5,
};

export const testSquad: RosterEntry[] = [
  { name: 'Ada', job: 'squire' },
  { name: 'Bram', job: 'archer' },
  { name: 'Cora', job: 'acolyte' },
  { name: 'Dain', job: 'squire' },
];

/** Names for drafted and recruited units. */
export const UNIT_NAMES = [
  'Ada', 'Bram', 'Cora', 'Dain', 'Edda', 'Fenn', 'Greta', 'Hale', 'Isolde', 'Jory', 'Kestrel', 'Lute',
  'Maren', 'Nils', 'Orla', 'Pell', 'Quill', 'Rook', 'Sabine', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yorick',
];
