import type { JobDef } from '../rules/types';

// Base jobs (docs/DESIGN.md §6.3) and the first hybrids (§6.4). Base jobs unlock
// abilities at Ranks 0/1/2; hybrids have two at Rank 0, then one at Ranks 1
// and 2. Every job's passive is learned at Rank 2 and its ultimate on mastery.

const defs: JobDef[] = [
  // --- Base jobs ---
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
    passives: ['counter'], ultimate: 'last-stand', equip: ['sword', 'shield'], model: 'capsule',
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
    passives: ['eagle-eye'], ultimate: 'rain-of-arrows', equip: ['bow'], model: 'capsule',
  },
  {
    id: 'mage', name: 'Mage', tier: 1, requires: [],
    statMods: { hp: 0.8, mp: 1.8, atk: 0.6, mag: 1.35, def: 0.8, res: 1.2, spd: 1 },
    move: 3, jump: 2, growth: {},
    attack: 'staff',
    actionSet: [
      { abilityId: 'flame', rank: 0 },
      { abilityId: 'frost', rank: 1 },
      { abilityId: 'spark', rank: 2 },
    ],
    passives: ['mana-well'], ultimate: 'meteor', equip: ['staff', 'rod'], model: 'capsule',
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
    passives: ['grace'], ultimate: 'sanctuary', equip: ['staff'], model: 'capsule',
  },
  {
    id: 'thief', name: 'Thief', tier: 1, requires: [],
    statMods: { hp: 0.9, mp: 0.8, atk: 1.05, mag: 0.7, def: 0.85, res: 0.9, spd: 1.25, evade: 3 },
    move: 5, jump: 3, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'steal', rank: 0 },
      { abilityId: 'backstab', rank: 1 },
      { abilityId: 'smoke', rank: 2 },
    ],
    passives: ['fleet'], ultimate: 'shadow-step', equip: ['dagger'], model: 'capsule',
  },
  {
    id: 'chemist', name: 'Chemist', tier: 1, requires: [],
    statMods: { hp: 1, mp: 1.2, atk: 0.9, mag: 1, def: 1, res: 1, spd: 1 },
    move: 3, jump: 2, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'potion-toss', rank: 0 },
      { abilityId: 'ether', rank: 1 },
      { abilityId: 'phoenix-draught', rank: 2 },
    ],
    passives: ['throw-range'], ultimate: 'panacea-rain', equip: ['dagger', 'gun'], model: 'capsule',
  },

  // --- Hybrids ---
  {
    id: 'paladin', name: 'Paladin', tier: 2, requires: ['squire', 'acolyte'],
    statMods: { hp: 1.25, mp: 0.9, atk: 1.05, mag: 1, def: 1.3, res: 1.2, spd: 0.95 },
    move: 3, jump: 2, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'holy-strike', rank: 0 },
      { abilityId: 'shield-ally', rank: 0 },
      { abilityId: 'smite', rank: 1 },
      { abilityId: 'consecrate', rank: 2 },
    ],
    passives: ['cover'], ultimate: 'holy-bulwark', equip: ['sword', 'shield'], model: 'capsule',
  },
  {
    id: 'spellblade', name: 'Spellblade', tier: 2, requires: ['squire', 'mage'],
    statMods: { hp: 1.1, mp: 1, atk: 1.15, mag: 1, def: 1.05, res: 1, spd: 1.05 },
    move: 4, jump: 2, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'fire-blade', rank: 0 },
      { abilityId: 'frost-blade', rank: 0 },
      { abilityId: 'thunder-blade', rank: 1 },
      { abilityId: 'drain-blade', rank: 2 },
    ],
    passives: ['arcane-edge'], ultimate: 'elemental-fury', equip: ['sword'], model: 'capsule',
  },
  {
    id: 'oracle', name: 'Oracle', tier: 2, requires: ['mage', 'acolyte'],
    statMods: { hp: 0.9, mp: 1.7, atk: 0.7, mag: 1.3, def: 0.9, res: 1.3, spd: 1.1 },
    move: 3, jump: 2, growth: {},
    attack: 'staff',
    actionSet: [
      { abilityId: 'haste', rank: 0 },
      { abilityId: 'slow', rank: 0 },
      { abilityId: 'quicken', rank: 1 },
      { abilityId: 'delay', rank: 2 },
    ],
    passives: ['foresight'], ultimate: 'stasis', equip: ['staff', 'rod'], model: 'capsule',
  },
  {
    id: 'ranger', name: 'Ranger', tier: 2, requires: ['archer', 'thief'],
    statMods: { hp: 1, mp: 1, atk: 1.1, mag: 0.7, def: 0.95, res: 0.9, spd: 1.15, evade: 1.5 },
    move: 4, jump: 3, growth: {},
    attack: 'shoot',
    actionSet: [
      { abilityId: 'snare-trap', rank: 0 },
      { abilityId: 'long-shot', rank: 0 },
      { abilityId: 'barbed-arrow', rank: 1 },
      { abilityId: 'hunters-volley', rank: 2 },
    ],
    passives: ['pathfinder'], ultimate: 'deadeye', equip: ['bow'], model: 'capsule',
  },
  {
    id: 'saboteur', name: 'Saboteur', tier: 2, requires: ['thief', 'chemist'],
    statMods: { hp: 0.95, mp: 1.1, atk: 1, mag: 0.9, def: 0.9, res: 0.95, spd: 1.15, evade: 2 },
    move: 4, jump: 3, growth: {},
    attack: 'strike',
    actionSet: [
      { abilityId: 'oil-slick', rank: 0 },
      { abilityId: 'land-mine', rank: 0 },
      { abilityId: 'poison-cloud', rank: 1 },
      { abilityId: 'sabotage', rank: 2 },
    ],
    passives: ['elusive'], ultimate: 'scorched-earth', equip: ['dagger'], model: 'capsule',
  },
];

export const JOBS: Record<string, JobDef> = Object.fromEntries(defs.map((j) => [j.id, j]));
