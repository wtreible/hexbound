import type { RosterEntry } from './units';

// Enemy groups. Each enemy is a job plus an AI preset (docs/DESIGN.md §10).
export type EnemyEntry = RosterEntry & { ai: 'berserker' };

export const banditGroup: EnemyEntry[] = [
  { name: 'Bandit', job: 'squire', ai: 'berserker' },
  { name: 'Bandit', job: 'squire', ai: 'berserker' },
  { name: 'Poacher', job: 'archer', ai: 'berserker' },
  { name: 'Poacher', job: 'archer', ai: 'berserker' },
];
