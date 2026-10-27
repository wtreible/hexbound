import type { JobDef } from '../rules/types';

// Base jobs (docs/DESIGN.md §6.3). Passives, ultimates and rank gating arrive in M4;
// until then every ability in the action set is usable.

const defs: JobDef[] = [
  {
    id: 'squire', name: 'Squire', tier: 1, requires: [],
    statMods: { hp: 1.2, mp: 0.5, atk: 1.1, mag: 0.6, def: 1.25, res: 0.9, spd: 1 },
    move: 4, jump: 2, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'rally-strike', rank: 0 },
      { abilityId: 'guard', rank: 1 },
      { abilityId: 'shove', rank: 2 },
    ],
    passives: [], equip: ['sword', 'shield'], model: 'capsule',
  },
  {
    id: 'archer', name: 'Archer', tier: 1, requires: [],
    statMods: { hp: 0.9, mp: 0.8, atk: 1, mag: 0.7, def: 0.9, res: 0.9, spd: 1.15 },
    move: 4, jump: 2, growth: {},
    attack: 'shoot',
    actionSet: [
      { abilityId: 'aim', rank: 0 },
      { abilityId: 'pin-shot', rank: 1 },
      { abilityId: 'volley', rank: 2 },
    ],
    passives: [], equip: ['bow'], model: 'capsule',
  },
  {
    id: 'acolyte', name: 'Acolyte', tier: 1, requires: [],
    statMods: { hp: 0.9, mp: 1.6, atk: 0.7, mag: 1.2, def: 0.9, res: 1.25, spd: 1 },
    move: 3, jump: 2, growth: {},
    attack: 'staff',
    actionSet: [
      { abilityId: 'mend', rank: 0 },
      { abilityId: 'purify', rank: 1 },
      { abilityId: 'revive', rank: 2 },
    ],
    passives: [], equip: ['staff'], model: 'capsule',
  },
];

export const JOBS: Record<string, JobDef> = Object.fromEntries(defs.map((j) => [j.id, j]));
