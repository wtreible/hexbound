import type { AbilityDef } from '../rules/types';

// Ability definitions (docs/DESIGN.md §6.3, §6.4, §8). Pure data: every
// behaviour comes from the effect pipeline in rules/abilities.ts and the
// passive handling in rules/jobs.ts.

const MELEE = { min: 1, max: 1, los: false } as const;
const SELF = { min: 0, max: 0, los: false } as const;
const SINGLE = { shape: 'single', size: 0 } as const;
const ULT = { resolve: 100 } as const;

const R = (min: number, max: number, heightBonus = false) => ({ min, max, los: false, heightBonus });
const DIAMOND1 = { shape: 'diamond', size: 1 } as const;
const CROSS1 = { shape: 'cross', size: 1 } as const;
const passive = (id: string, name: string, kind: 'reaction' | 'support' | 'movement', effects: AbilityDef['passive'], description: string): AbilityDef => ({
  id, name, kind, range: SELF, area: SINGLE, effects: [], passive: effects, tags: [], description,
});

const defs: AbilityDef[] = [
  // --- Basic attacks ---
  {
    id: 'strike', name: 'Strike', kind: 'action', range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1 }],
    tags: ['physical', 'melee'], description: 'A plain weapon attack.',
  },
  {
    id: 'shoot', name: 'Shoot', kind: 'action',
    range: { min: 2, max: 4, los: true, heightBonus: true }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1 }],
    tags: ['physical', 'bow'], description: 'A bow shot. +1 range per 2 tiers of height.',
  },
  {
    id: 'staff', name: 'Staff', kind: 'action', range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 0.8 }],
    tags: ['physical', 'melee'], description: 'A light staff blow.',
  },

  // --- Squire ---
  {
    id: 'rally-strike', name: 'Rally Strike', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.4 }],
    tags: ['physical', 'melee'], description: 'A heavy committed blow.',
  },
  {
    id: 'guard', name: 'Guard', kind: 'action', range: SELF, area: SINGLE,
    effects: [{ type: 'status', status: 'guard', chance: 1, duration: 1 }],
    tags: [], description: 'Raise defence by half until your next turn.',
  },
  {
    id: 'shove', name: 'Shove', kind: 'action', cost: { mp: 2 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 0.6 }, { type: 'push', distance: 1 }],
    tags: ['physical', 'melee'], description: 'A light hit that knocks the target back one tile.',
  },
  {
    id: 'counter', name: 'Counter', kind: 'reaction', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'counter' }], tags: [], description: 'Strike back with your basic attack when hit in melee.',
  },
  {
    id: 'last-stand', name: 'Last Stand', kind: 'ultimate', cost: ULT, range: SELF, area: SINGLE,
    effects: [{ type: 'heal', pct: 0.5 }, { type: 'status', status: 'guard', chance: 1, duration: 2 }],
    tags: [], description: 'Recover half your HP and guard for two turns.',
  },

  // --- Archer ---
  {
    id: 'aim', name: 'Aim', kind: 'action', cost: { mp: 3 },
    range: { min: 2, max: 5, los: true, heightBonus: true }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.5 }],
    tags: ['physical', 'bow'], description: 'A careful long-range shot.',
  },
  {
    id: 'pin-shot', name: 'Pin Shot', kind: 'action', cost: { mp: 4 },
    range: { min: 2, max: 4, los: true, heightBonus: true }, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'atk', power: 0.8 },
      { type: 'status', status: 'pinned', chance: 0.8, duration: 2 },
    ],
    tags: ['physical', 'bow'], description: 'Wounds and pins the target: -2 move.',
  },
  {
    id: 'volley', name: 'Volley', kind: 'action', cost: { mp: 6 },
    range: { min: 3, max: 5, los: false, heightBonus: true }, area: { shape: 'cross', size: 1 },
    effects: [{ type: 'damage', stat: 'atk', power: 0.7 }],
    tags: ['physical', 'bow'], description: 'Arrows rain on a cross-shaped area. Hits allies too.',
  },
  {
    id: 'eagle-eye', name: 'Eagle Eye', kind: 'support', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'range', tag: 'bow', add: 1 }], tags: [], description: '+1 range with bows.',
  },
  {
    id: 'rain-of-arrows', name: 'Rain of Arrows', kind: 'ultimate', cost: ULT, chargeTicks: 6,
    range: { min: 3, max: 6, los: false, heightBonus: true }, area: { shape: 'diamond', size: 2 }, affects: 'foes',
    effects: [{ type: 'damage', stat: 'atk', power: 1 }],
    tags: ['physical', 'bow'], description: 'Arrows blanket a wide area, sparing allies.',
  },

  // --- Mage ---
  {
    id: 'flame', name: 'Flame', kind: 'action', cost: { mp: 4 },
    range: { min: 1, max: 4, los: false }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'mag', power: 1.3, element: 'fire' }],
    tags: ['magic', 'fire'], description: 'A burst of fire. Ignites oil laid by another player.',
  },
  {
    id: 'frost', name: 'Frost', kind: 'action', cost: { mp: 5 },
    range: { min: 1, max: 4, los: false }, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'mag', power: 1, element: 'ice' },
      { type: 'status', status: 'slow', chance: 0.7, duration: 2 },
    ],
    tags: ['magic', 'ice'], description: 'Ice damage that may slow the target.',
  },
  {
    id: 'spark', name: 'Spark', kind: 'action', cost: { mp: 6 },
    range: { min: 1, max: 4, los: false }, area: { shape: 'cross', size: 1 }, affects: 'foes',
    effects: [{ type: 'damage', stat: 'mag', power: 0.9, element: 'lightning' }],
    tags: ['magic', 'lightning'], description: 'Lightning that chains to adjacent foes.',
  },
  {
    id: 'mana-well', name: 'Mana Well', kind: 'support', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'mp-regen', amount: 3 }], tags: [], description: 'Recover 3 MP at the start of each turn.',
  },
  {
    id: 'meteor', name: 'Meteor', kind: 'ultimate', cost: ULT, chargeTicks: 8,
    range: { min: 2, max: 5, los: false }, area: { shape: 'diamond', size: 1 },
    effects: [{ type: 'damage', stat: 'mag', power: 2.2, element: 'fire' }],
    tags: ['magic', 'fire'], description: 'A falling star that lands after a delay. Hits everything in the area, allies included.',
  },

  // --- Acolyte ---
  {
    id: 'mend', name: 'Mend', kind: 'action', cost: { mp: 4 },
    range: { min: 0, max: 3, los: false }, area: SINGLE,
    effects: [{ type: 'heal', power: 0.8 }],
    tags: ['magic', 'holy'], description: 'Restore HP to one unit.',
  },
  {
    id: 'purify', name: 'Purify', kind: 'action', cost: { mp: 3 },
    range: { min: 0, max: 3, los: false }, area: SINGLE,
    effects: [{ type: 'cleanse' }],
    tags: ['magic', 'holy'], description: 'Remove all status effects from one unit.',
  },
  {
    id: 'revive', name: 'Revive', kind: 'action', cost: { mp: 8 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'revive', hpPct: 0.3 }],
    tags: ['magic', 'holy'], description: 'Raise a downed ally with 30% HP.',
  },
  {
    id: 'grace', name: 'Grace', kind: 'support', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'heal-boost', pct: 0.2 }], tags: [], description: 'Your healing is 20% stronger.',
  },
  {
    id: 'sanctuary', name: 'Sanctuary', kind: 'ultimate', cost: ULT,
    range: SELF, area: { shape: 'diamond', size: 2 }, affects: 'allies',
    effects: [{ type: 'heal', power: 1 }, { type: 'cleanse' }, { type: 'status', status: 'regen', chance: 1, duration: 3 }],
    tags: ['magic', 'holy'], description: 'Heal, cleanse and grant Regen to every ally within 2 tiles.',
  },

  // --- Thief ---
  {
    id: 'steal', name: 'Steal', kind: 'action', range: MELEE, area: SINGLE,
    effects: [{ type: 'mp', amount: 6, steal: true }],
    tags: ['physical', 'melee'], description: 'Take up to 6 MP from the target. (Items arrive with the shop.)',
  },
  {
    id: 'backstab', name: 'Backstab', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.1, facingMultiplier: 3 }],
    tags: ['physical', 'melee'], description: 'Triple the usual bonus for striking from the side or behind.',
  },
  {
    id: 'smoke', name: 'Smoke', kind: 'action', cost: { mp: 4 },
    range: { min: 0, max: 2, los: false }, area: { shape: 'diamond', size: 1 }, affects: 'allies',
    effects: [{ type: 'status', status: 'veil', chance: 1, duration: 2 }],
    tags: ['throw'], description: 'A smoke cloud: allies inside gain +30 evade.',
  },
  {
    id: 'fleet', name: 'Fleet', kind: 'movement', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'move', add: 1 }], tags: [], description: '+1 move.',
  },
  {
    id: 'shadow-step', name: 'Shadow Step', kind: 'ultimate', cost: ULT,
    range: { min: 1, max: 5, los: false }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.6, forceSide: 'back' }],
    tags: ['physical'], description: 'Appear behind a target up to 5 tiles away and strike: always a hit from behind.',
  },

  // --- Chemist ---
  {
    id: 'potion-toss', name: 'Potion Toss', kind: 'action', cost: { mp: 2 },
    range: { min: 0, max: 2, los: false }, area: SINGLE,
    effects: [{ type: 'heal', flat: 25 }],
    tags: ['throw'], description: 'Throw a potion: restores 25 HP.',
  },
  {
    id: 'ether', name: 'Ether', kind: 'action',
    range: { min: 0, max: 2, los: false }, area: SINGLE,
    effects: [{ type: 'mp', amount: 12 }],
    tags: ['throw'], description: 'Throw an ether: restores 12 MP.',
  },
  {
    id: 'phoenix-draught', name: 'Phoenix Draught', kind: 'action', cost: { mp: 4 },
    range: { min: 1, max: 2, los: false }, area: SINGLE,
    effects: [{ type: 'revive', hpPct: 0.5 }],
    tags: ['throw'], description: 'Raise a downed ally with 50% HP.',
  },
  {
    id: 'throw-range', name: 'Throw Range +2', kind: 'support', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'range', tag: 'throw', add: 2 }], tags: [], description: '+2 range for thrown items.',
  },
  {
    id: 'panacea-rain', name: 'Panacea Rain', kind: 'ultimate', cost: ULT,
    range: { min: 0, max: 4, los: false }, area: { shape: 'diamond', size: 1 }, affects: 'allies',
    effects: [{ type: 'heal', pct: 0.4 }, { type: 'cleanse' }, { type: 'revive', hpPct: 0.25 }],
    tags: ['throw'], description: 'Heal, cleanse and revive allies in the area.',
  },

  // --- Paladin (Squire + Acolyte) ---
  {
    id: 'holy-strike', name: 'Holy Strike', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.25, element: 'holy' }],
    tags: ['physical', 'melee', 'holy'], description: 'A blessed blow.',
  },
  {
    id: 'shield-ally', name: 'Shield Ally', kind: 'action', cost: { mp: 2 }, range: MELEE, area: SINGLE, affects: 'allies',
    effects: [{ type: 'status', status: 'guard', chance: 1, duration: 1 }],
    tags: [], description: 'Guard an adjacent ally until its next turn.',
  },
  {
    id: 'smite', name: 'Smite', kind: 'action', cost: { mp: 5 },
    range: { min: 1, max: 2, los: false }, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'mag', power: 1.4, element: 'holy' },
      { type: 'status', status: 'silence', chance: 0.35, duration: 2 },
    ],
    tags: ['magic', 'holy'], description: 'Holy light strikes a nearby foe and may silence it.',
  },
  {
    id: 'consecrate', name: 'Consecrate', kind: 'action', cost: { mp: 6 },
    range: SELF, area: { shape: 'diamond', size: 1 }, affects: 'allies',
    effects: [{ type: 'heal', power: 0.6 }],
    tags: ['magic', 'holy'], description: 'Heal yourself and adjacent allies.',
  },
  {
    id: 'cover', name: 'Cover', kind: 'reaction', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'cover' }], tags: [], description: 'Take single-target attacks aimed at adjacent allies.',
  },
  {
    id: 'holy-bulwark', name: 'Holy Bulwark', kind: 'ultimate', cost: ULT,
    range: SELF, area: { shape: 'diamond', size: 1 }, affects: 'allies',
    effects: [{ type: 'heal', pct: 0.2 }, { type: 'status', status: 'guard', chance: 1, duration: 2 }],
    tags: ['holy'], description: 'You and adjacent allies heal and guard for two turns.',
  },

  // --- Spellblade (Squire + Mage) ---
  {
    id: 'fire-blade', name: 'Fire Blade', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.3, element: 'fire' }],
    tags: ['physical', 'melee', 'fire'], description: 'A burning strike. Ignites oil laid by another player.',
  },
  {
    id: 'frost-blade', name: 'Frost Blade', kind: 'action', cost: { mp: 4 }, range: MELEE, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'atk', power: 1, element: 'ice' },
      { type: 'status', status: 'slow', chance: 0.6, duration: 2 },
    ],
    tags: ['physical', 'melee', 'ice'], description: 'A freezing strike that may slow.',
  },
  {
    id: 'thunder-blade', name: 'Thunder Blade', kind: 'action', cost: { mp: 5 },
    range: MELEE, area: { shape: 'line', size: 1 }, affects: 'foes',
    effects: [{ type: 'damage', stat: 'atk', power: 0.9, element: 'lightning' }],
    tags: ['physical', 'melee', 'lightning'], description: 'Lightning runs through the target into the foe behind it.',
  },
  {
    id: 'drain-blade', name: 'Drain Blade', kind: 'action', range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 0.9 }, { type: 'mp', amount: 5, steal: true }],
    tags: ['physical', 'melee'], description: 'A strike that drains 5 MP.',
  },
  {
    id: 'arcane-edge', name: 'Arcane Edge', kind: 'support', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'mp-on-hit', amount: 2 }], tags: [], description: 'Recover 2 MP whenever you deal damage.',
  },
  {
    id: 'elemental-fury', name: 'Elemental Fury', kind: 'ultimate', cost: ULT, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 3, element: 'fire' }],
    tags: ['physical', 'melee', 'fire'], description: 'An overwhelming elemental strike.',
  },

  // --- Oracle (Mage + Acolyte) ---
  {
    id: 'haste', name: 'Haste', kind: 'action', cost: { mp: 5 },
    range: { min: 0, max: 3, los: false }, area: SINGLE, affects: 'allies',
    effects: [{ type: 'status', status: 'haste', chance: 1, duration: 3 }],
    tags: ['magic'], description: 'Speed x1.5 for three turns.',
  },
  {
    id: 'slow', name: 'Slow', kind: 'action', cost: { mp: 4 },
    range: { min: 1, max: 4, los: false }, area: SINGLE, affects: 'foes',
    effects: [{ type: 'status', status: 'slow', chance: 0.8, duration: 3 }],
    tags: ['magic'], description: 'Speed x0.5 for three turns.',
  },
  {
    id: 'quicken', name: 'Quicken', kind: 'action', cost: { mp: 6 },
    range: { min: 1, max: 3, los: false }, area: SINGLE, affects: 'allies',
    effects: [{ type: 'ct', delta: 50 }],
    tags: ['magic'], description: "Advance an ally's next turn: +50 CT.",
  },
  {
    id: 'delay', name: 'Delay', kind: 'action', cost: { mp: 6 },
    range: { min: 1, max: 4, los: false }, area: SINGLE, affects: 'foes',
    effects: [{ type: 'ct', delta: -40 }],
    tags: ['magic'], description: "Push back a foe's next turn: -40 CT.",
  },
  {
    id: 'foresight', name: 'Foresight', kind: 'reaction', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'evade', add: 10 }], tags: [], description: '+10 evade.',
  },
  {
    id: 'stasis', name: 'Stasis', kind: 'ultimate', cost: ULT, chargeTicks: 5,
    range: { min: 1, max: 4, los: false }, area: { shape: 'diamond', size: 1 }, affects: 'foes',
    effects: [{ type: 'ct', delta: -100 }],
    tags: ['magic'], description: 'Freeze time around foes: -100 CT.',
  },

  // --- Ranger (Archer + Thief) ---
  {
    id: 'snare-trap', name: 'Snare Trap', kind: 'action', cost: { mp: 3 },
    range: { min: 1, max: 3, los: false }, area: SINGLE,
    effects: [{ type: 'hazard', hazard: 'trap', rounds: 6 }],
    tags: ['throw'], description: 'Set a trap on an empty tile. A foe entering it stops, takes damage and is pinned.',
  },
  {
    id: 'long-shot', name: 'Long Shot', kind: 'action', cost: { mp: 4 },
    range: { min: 3, max: 7, los: true, heightBonus: true }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.1 }],
    tags: ['physical', 'bow'], description: 'A shot from very far away.',
  },
  {
    id: 'barbed-arrow', name: 'Barbed Arrow', kind: 'action', cost: { mp: 4 },
    range: { min: 2, max: 5, los: true, heightBonus: true }, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'atk', power: 0.8 },
      { type: 'status', status: 'poison', chance: 0.8, duration: 3 },
    ],
    tags: ['physical', 'bow'], description: 'A wound that may poison.',
  },
  {
    id: 'hunters-volley', name: "Hunter's Volley", kind: 'action', cost: { mp: 7 },
    range: { min: 3, max: 5, los: false, heightBonus: true }, area: { shape: 'cross', size: 1 }, affects: 'foes',
    effects: [{ type: 'damage', stat: 'atk', power: 0.9 }],
    tags: ['physical', 'bow'], description: 'A precise volley that spares allies.',
  },
  {
    id: 'pathfinder', name: 'Pathfinder', kind: 'movement', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'jump', add: 1 }], tags: [], description: '+1 jump.',
  },
  {
    id: 'deadeye', name: 'Deadeye', kind: 'ultimate', cost: ULT,
    range: { min: 2, max: 8, los: true, heightBonus: true }, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 2.5, forceSide: 'back' }],
    tags: ['physical', 'bow'], description: 'A shot that finds the weak spot: always a hit from behind.',
  },

  // --- Saboteur (Thief + Chemist) ---
  {
    id: 'oil-slick', name: 'Oil Slick', kind: 'action', cost: { mp: 3 },
    range: { min: 1, max: 3, los: false }, area: { shape: 'diamond', size: 1 },
    effects: [{ type: 'hazard', hazard: 'oil', rounds: 4 }],
    tags: ['throw'], description: "Spill oil. Another player's fire ignites it (Ignite combo).",
  },
  {
    id: 'land-mine', name: 'Land Mine', kind: 'action', cost: { mp: 4 },
    range: { min: 1, max: 2, los: false }, area: SINGLE,
    effects: [{ type: 'hazard', hazard: 'mine', rounds: 6 }],
    tags: ['throw'], description: 'Bury a mine on an empty tile. A foe entering it stops and takes heavy damage.',
  },
  {
    id: 'poison-cloud', name: 'Poison Cloud', kind: 'action', cost: { mp: 6 },
    range: { min: 1, max: 3, los: false }, area: { shape: 'diamond', size: 1 },
    effects: [
      { type: 'status', status: 'poison', chance: 0.9, duration: 3 },
      { type: 'status', status: 'blind', chance: 0.5, duration: 2 },
    ],
    tags: ['throw'], description: 'A cloud that poisons, and may blind, everyone inside, allies included.',
  },
  {
    id: 'sabotage', name: 'Sabotage', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [
      { type: 'damage', stat: 'atk', power: 0.8 },
      { type: 'status', status: 'slow', chance: 0.8, duration: 2 },
    ],
    tags: ['physical', 'melee'], description: 'Hamstring the target: damage and slow.',
  },
  {
    id: 'elusive', name: 'Elusive', kind: 'reaction', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'evade', add: 10 }], tags: [], description: '+10 evade.',
  },
  {
    id: 'scorched-earth', name: 'Scorched Earth', kind: 'ultimate', cost: ULT, chargeTicks: 6,
    range: { min: 1, max: 3, los: false }, area: { shape: 'diamond', size: 2 }, affects: 'foes',
    effects: [
      { type: 'damage', stat: 'mag', power: 0.8, element: 'fire' },
      { type: 'hazard', hazard: 'fire', rounds: 2 },
    ],
    tags: ['magic', 'fire'], description: 'Set a wide area ablaze for two rounds.',
  },

  // ===== M7: more abilities per job, FFT-style (decision 0023) =====

  // --- Squire ---
  { id: 'throw-stone', name: 'Throw Stone', kind: 'action', range: R(2, 4), area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 0.6 }], tags: ['physical', 'throw'], description: 'A thrown stone. Weak, but reaches.' },
  { id: 'accumulate', name: 'Accumulate', kind: 'action', range: SELF, area: SINGLE, effects: [{ type: 'status', status: 'focus', chance: 1, duration: 2 }], tags: [], description: 'Steady yourself: +20 hit for two turns.' },
  { id: 'first-aid', name: 'First Aid', kind: 'action', range: R(0, 1), area: SINGLE, affects: 'allies', effects: [{ type: 'heal', pct: 0.2 }, { type: 'cleanse' }], tags: [], description: 'Patch up yourself or an adjacent ally: 20% HP and cure statuses.' },
  passive('jp-boost', 'JP Boost', 'support', [{ type: 'jp-boost', pct: 0.5 }], '+50% JP earned.'),

  // --- Archer ---
  { id: 'piercing-shot', name: 'Piercing Shot', kind: 'action', cost: { mp: 4 }, range: R(2, 4, true), area: { shape: 'line', size: 2 }, affects: 'foes', effects: [{ type: 'damage', stat: 'atk', power: 0.9 }], tags: ['physical', 'bow'], description: 'An arrow that passes through up to three foes in a line.' },
  { id: 'charge-shot', name: 'Charged Shot', kind: 'action', cost: { mp: 3 }, chargeTicks: 4, range: R(2, 5, true), area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 2 }], tags: ['physical', 'bow'], description: 'Draw for a moment, then a heavy shot lands on the tile.' },
  passive('sixth-sense', 'Sixth Sense', 'reaction', [{ type: 'stat', stat: 'evade', add: 12 }], '+12 evade.'),
  passive('jump-plus', 'Jump +1', 'movement', [{ type: 'stat', stat: 'jump', add: 1 }], '+1 jump.'),

  // --- Mage ---
  { id: 'inferno', name: 'Inferno', kind: 'action', cost: { mp: 10 }, chargeTicks: 3, range: R(1, 4), area: DIAMOND1, effects: [{ type: 'damage', stat: 'mag', power: 1.1, element: 'fire' }], tags: ['magic', 'fire'], description: 'A burst of flame on an area after a short chant. Hits allies too.' },
  { id: 'enfeeble', name: 'Enfeeble', kind: 'action', cost: { mp: 5 }, range: R(1, 4), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'weaken', chance: 0.8, duration: 3 }], tags: ['magic'], description: 'Weaken a foe: it deals 25% less damage.' },
  passive('magic-boost', 'Magic Boost', 'support', [{ type: 'damage-boost', pct: 0.2, tag: 'magic' }], '+20% damage with magic.'),

  // --- Acolyte ---
  { id: 'protect', name: 'Protect', kind: 'action', cost: { mp: 4 }, range: R(0, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'status', status: 'protect', chance: 1, duration: 3 }], tags: ['magic'], description: 'An ally takes 25% less physical damage.' },
  { id: 'shell', name: 'Shell', kind: 'action', cost: { mp: 4 }, range: R(0, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'status', status: 'shell', chance: 1, duration: 3 }], tags: ['magic'], description: 'An ally takes 25% less magic damage.' },
  { id: 'regen', name: 'Regen', kind: 'action', cost: { mp: 5 }, range: R(0, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'status', status: 'regen', chance: 1, duration: 4 }], tags: ['magic', 'holy'], description: 'An ally heals 10% of max HP each turn.' },
  passive('auto-mend', 'Auto-Mend', 'reaction', [{ type: 'reaction-heal', pct: 0.25 }], 'After surviving a hit, heal a quarter of the damage.'),

  // --- Thief ---
  { id: 'trip', name: 'Trip', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 0.5 }, { type: 'status', status: 'pinned', chance: 0.9, duration: 2 }], tags: ['physical', 'melee'], description: 'A low kick: light damage and -2 move.' },
  { id: 'blind-dust', name: 'Blinding Dust', kind: 'action', cost: { mp: 3 }, range: R(1, 2), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'blind', chance: 0.8, duration: 2 }], tags: ['throw'], description: 'Dust in the eyes: -40 physical hit.' },
  passive('vanish-step', 'Vanish Step', 'reaction', [{ type: 'stat', stat: 'evade', add: 15 }], '+15 evade.'),

  // --- Chemist ---
  { id: 'antidote-toss', name: 'Antidote', kind: 'action', range: R(0, 2), area: SINGLE, effects: [{ type: 'cleanse' }], tags: ['throw'], description: 'Throw a remedy: cures all statuses.' },
  { id: 'hi-potion', name: 'Hi-Potion', kind: 'action', cost: { mp: 6 }, range: R(0, 2), area: SINGLE, effects: [{ type: 'heal', flat: 50 }], tags: ['throw'], description: 'A strong potion: restores 50 HP.' },
  passive('auto-potion', 'Auto-Potion', 'reaction', [{ type: 'reaction-heal', pct: 0.3 }], 'After surviving a hit, heal 30% of the damage.'),

  // --- Dragoon ---
  { id: 'jump', name: 'Jump', kind: 'action', cost: { mp: 3 }, chargeTicks: 5, range: R(1, 4), area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1.8 }], tags: ['physical', 'jump'], description: 'Leap off the board and land on the tile a moment later. Untargetable while airborne.' },
  { id: 'spear-sweep', name: 'Spear Sweep', kind: 'action', cost: { mp: 3 }, range: MELEE, area: { shape: 'cone', size: 1 }, affects: 'foes', effects: [{ type: 'damage', stat: 'atk', power: 0.9 }], tags: ['physical', 'melee'], description: 'A wide sweep hitting the foe ahead and those beside it.' },
  passive('dragon-heart', 'Dragon Heart', 'reaction', [{ type: 'reaction-heal', pct: 0.35 }], 'After surviving a hit, heal 35% of the damage.'),
  passive('leap', 'Leap', 'movement', [{ type: 'stat', stat: 'jump', add: 3 }], '+3 jump.'),
  { id: 'dragon-dive', name: 'Dragon Dive', kind: 'ultimate', cost: ULT, chargeTicks: 6, range: R(1, 5), area: DIAMOND1, affects: 'foes', effects: [{ type: 'damage', stat: 'atk', power: 2.2 }], tags: ['physical', 'jump'], description: 'A towering leap that crashes down on an area.' },

  // --- Monk ---
  { id: 'pummel', name: 'Pummel', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1.3 }], tags: ['physical', 'melee', 'unarmed'], description: 'A flurry of punches.' },
  { id: 'chakra', name: 'Chakra', kind: 'action', cost: { mp: 4 }, range: SELF, area: DIAMOND1, affects: 'allies', effects: [{ type: 'heal', pct: 0.25 }], tags: [], description: 'Heal yourself and adjacent allies by 25% of max HP.' },
  { id: 'wave-fist', name: 'Wave Fist', kind: 'action', cost: { mp: 3 }, range: R(1, 3), area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1 }], tags: ['physical', 'unarmed'], description: 'A shockwave punch that reaches three tiles.' },
  { id: 'second-wind', name: 'Second Wind', kind: 'action', cost: { mp: 6 }, range: MELEE, area: SINGLE, effects: [{ type: 'revive', hpPct: 0.25 }], tags: [], description: 'Slap a downed ally awake with 25% HP.' },
  passive('martial-arts', 'Martial Arts', 'support', [{ type: 'damage-boost', pct: 0.3, tag: 'unarmed' }], '+30% damage with unarmed abilities.'),
  passive('swift-feet', 'Swift Feet', 'movement', [{ type: 'stat', stat: 'move', add: 1 }], '+1 move.'),
  { id: 'hundred-fists', name: 'Hundred Fists', kind: 'ultimate', cost: ULT, range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 3.2 }], tags: ['physical', 'melee', 'unarmed'], description: 'An unstoppable barrage.' },

  // --- Hexer ---
  { id: 'curse', name: 'Curse', kind: 'action', cost: { mp: 5 }, range: R(1, 4), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'poison', chance: 0.9, duration: 3 }, { type: 'status', status: 'weaken', chance: 0.6, duration: 3 }], tags: ['magic', 'dark'], description: 'Poison and maybe weaken a foe.' },
  { id: 'hex-blind', name: 'Hex of Silence', kind: 'action', cost: { mp: 6 }, range: R(1, 4), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'silence', chance: 0.7, duration: 2 }, { type: 'status', status: 'blind', chance: 0.6, duration: 2 }], tags: ['magic', 'dark'], description: 'Silence and blind a foe.' },
  { id: 'dispel', name: 'Dispel', kind: 'action', cost: { mp: 4 }, range: R(1, 4), area: SINGLE, affects: 'foes', effects: [{ type: 'dispel' }], tags: ['magic'], description: "Strip a foe's helpful statuses." },
  { id: 'doom-bolt', name: 'Doom Bolt', kind: 'action', cost: { mp: 8 }, range: R(1, 4), area: SINGLE, effects: [{ type: 'damage', stat: 'mag', power: 1.3, element: 'dark' }, { type: 'dispel' }], tags: ['magic', 'dark'], description: 'Dark damage that also strips buffs.' },
  passive('malice', 'Malice', 'support', [{ type: 'damage-boost', pct: 0.25, tag: 'dark' }], '+25% damage with dark abilities.'),
  { id: 'unravel', name: 'Unravel', kind: 'ultimate', cost: ULT, range: R(1, 4), area: DIAMOND1, affects: 'foes', effects: [{ type: 'dispel' }, { type: 'status', status: 'weaken', chance: 1, duration: 3 }, { type: 'status', status: 'slow', chance: 1, duration: 3 }], tags: ['magic', 'dark'], description: 'Unmake every foe in an area: dispel, weaken and slow.' },

  // --- Grenadier ---
  { id: 'frag-bomb', name: 'Frag Bomb', kind: 'action', cost: { mp: 4 }, range: R(2, 4, true), area: CROSS1, effects: [{ type: 'damage', stat: 'atk', power: 0.9, element: 'fire' }], tags: ['physical', 'throw', 'fire'], description: 'A bomb that bursts in a cross. Ignites oil laid by another player.' },
  { id: 'oil-flask', name: 'Oil Flask', kind: 'action', cost: { mp: 3 }, range: R(2, 4), area: CROSS1, effects: [{ type: 'hazard', hazard: 'oil', rounds: 4 }], tags: ['throw'], description: 'Splash oil in a cross: fuel for Ignite.' },
  { id: 'smoke-bomb', name: 'Smoke Bomb', kind: 'action', cost: { mp: 4 }, range: R(2, 4), area: CROSS1, affects: 'foes', effects: [{ type: 'status', status: 'blind', chance: 0.8, duration: 2 }], tags: ['throw'], description: 'Blind foes in a cross.' },
  { id: 'firebomb', name: 'Firebomb', kind: 'action', cost: { mp: 7 }, range: R(2, 4), area: DIAMOND1, effects: [{ type: 'damage', stat: 'atk', power: 0.8, element: 'fire' }, { type: 'hazard', hazard: 'fire', rounds: 2 }], tags: ['physical', 'throw', 'fire'], description: 'Fire damage and burning ground for 2 rounds.' },
  passive('demolitions', 'Demolitions', 'support', [{ type: 'damage-boost', pct: 0.25, tag: 'throw' }], '+25% damage with thrown abilities.'),
  { id: 'carpet-bomb', name: 'Carpet Bomb', kind: 'ultimate', cost: ULT, chargeTicks: 5, range: R(2, 5), area: { shape: 'diamond', size: 2 }, affects: 'foes', effects: [{ type: 'damage', stat: 'atk', power: 1.4, element: 'fire' }], tags: ['physical', 'throw', 'fire'], description: 'A barrage of bombs on a wide area.' },

  // --- Seer ---
  { id: 'mark', name: 'Mark', kind: 'action', cost: { mp: 2 }, range: R(1, 6), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'mark', chance: 1, duration: 2 }], tags: ['magic', 'seer'], description: "Mark a foe: +30 to hit it. Another player's archer gets Volley Mark." },
  { id: 'focus', name: 'Focus', kind: 'action', cost: { mp: 3 }, range: R(0, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'status', status: 'focus', chance: 1, duration: 3 }], tags: ['magic'], description: 'An ally gains +20 hit.' },
  { id: 'blessing', name: 'Blessing', kind: 'action', cost: { mp: 7 }, range: R(0, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'status', status: 'protect', chance: 1, duration: 3 }, { type: 'status', status: 'shell', chance: 1, duration: 3 }], tags: ['magic', 'holy'], description: 'Protect and Shell on one ally.' },
  { id: 'true-shot', name: 'True Shot', kind: 'action', cost: { mp: 5 }, range: R(2, 5, true), area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1.2, forceSide: 'back' }], tags: ['physical', 'bow'], description: 'A shot that always finds the weak spot.' },
  passive('third-eye', 'Third Eye', 'support', [{ type: 'range', tag: 'bow', add: 1 }, { type: 'stat', stat: 'evade', add: 5 }], '+1 bow range, +5 evade.'),
  { id: 'prophecy', name: 'Prophecy', kind: 'ultimate', cost: ULT, range: SELF, area: { shape: 'diamond', size: 2 }, affects: 'allies', effects: [{ type: 'status', status: 'focus', chance: 1, duration: 3 }, { type: 'status', status: 'haste', chance: 1, duration: 2 }], tags: ['magic'], description: 'Allies within 2 tiles gain Focus and Haste.' },

  // --- Templar ---
  { id: 'holy-lance', name: 'Holy Lance', kind: 'action', cost: { mp: 6 }, range: MELEE, area: { shape: 'line', size: 2 }, affects: 'foes', effects: [{ type: 'damage', stat: 'mag', power: 1.4, element: 'holy' }], tags: ['magic', 'holy'], description: 'A spear of light through three tiles.' },
  { id: 'aegis', name: 'Aegis', kind: 'action', cost: { mp: 8 }, range: SELF, area: DIAMOND1, affects: 'allies', effects: [{ type: 'status', status: 'protect', chance: 1, duration: 3 }, { type: 'status', status: 'shell', chance: 1, duration: 3 }], tags: ['magic', 'holy'], description: 'Protect and Shell on you and adjacent allies.' },
  { id: 'judgment', name: 'Judgment', kind: 'action', cost: { mp: 10 }, chargeTicks: 4, range: R(1, 4), area: DIAMOND1, affects: 'foes', effects: [{ type: 'damage', stat: 'mag', power: 1.3, element: 'holy' }], tags: ['magic', 'holy'], description: 'Holy light falls on an area of foes after a short prayer.' },
  passive('holy-ward', 'Holy Ward', 'support', [{ type: 'stat', stat: 'res', add: 6 }], '+6 RES.'),
  { id: 'divine-shield', name: 'Divine Shield', kind: 'ultimate', cost: ULT, range: SELF, area: { shape: 'diamond', size: 2 }, affects: 'allies', effects: [{ type: 'status', status: 'protect', chance: 1, duration: 3 }, { type: 'status', status: 'shell', chance: 1, duration: 3 }, { type: 'status', status: 'regen', chance: 1, duration: 3 }], tags: ['magic', 'holy'], description: 'Protect, Shell and Regen on every ally within 2 tiles.' },

  // --- Chronomancer ---
  { id: 'quickstep', name: 'Quickstep', kind: 'action', cost: { mp: 10 }, range: R(1, 3), area: SINGLE, affects: 'allies', effects: [{ type: 'ct', delta: 100 }], tags: ['magic'], description: 'An ally takes its next turn almost at once.' },
  { id: 'time-slip', name: 'Time Slip', kind: 'action', cost: { mp: 8 }, range: R(1, 4), area: DIAMOND1, affects: 'foes', effects: [{ type: 'ct', delta: -60 }], tags: ['magic'], description: "Push back the turns of foes in an area: -60 CT." },
  { id: 'age', name: 'Age', kind: 'action', cost: { mp: 6 }, range: R(1, 4), area: SINGLE, affects: 'foes', effects: [{ type: 'status', status: 'weaken', chance: 0.8, duration: 3 }, { type: 'status', status: 'slow', chance: 0.8, duration: 3 }], tags: ['magic'], description: 'Wither a foe: weaken and slow.' },
  passive('time-sense', 'Time Sense', 'support', [{ type: 'stat', stat: 'spd', add: 2 }], '+2 SPD.'),
  { id: 'time-loop', name: 'Time Loop', kind: 'ultimate', cost: ULT, range: SELF, area: { shape: 'diamond', size: 2 }, affects: 'allies', effects: [{ type: 'ct', delta: 60 }, { type: 'status', status: 'haste', chance: 1, duration: 3 }], tags: ['magic'], description: 'Allies within 2 tiles gain +60 CT and Haste.' },

  // --- Runeknight ---
  { id: 'rune-of-power', name: 'Rune of Power', kind: 'action', cost: { mp: 6 }, range: R(0, 2), area: DIAMOND1, effects: [{ type: 'hazard', hazard: 'rune', rounds: 4 }], tags: ['magic'], description: 'Inscribe runes: allies who start a turn on one are Empowered (+25% damage).' },
  { id: 'rune-blade', name: 'Rune Blade', kind: 'action', cost: { mp: 4 }, range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1.4, element: 'holy' }], tags: ['physical', 'melee', 'holy'], description: 'A strike carried by a rune.' },
  { id: 'rune-ward', name: 'Rune Ward', kind: 'action', cost: { mp: 5 }, range: SELF, area: SINGLE, effects: [{ type: 'status', status: 'protect', chance: 1, duration: 3 }, { type: 'status', status: 'regen', chance: 1, duration: 3 }], tags: ['magic'], description: 'Protect and Regen on yourself.' },
  { id: 'runeburst', name: 'Runeburst', kind: 'action', cost: { mp: 9 }, range: R(1, 3), area: DIAMOND1, affects: 'foes', effects: [{ type: 'damage', stat: 'mag', power: 1.3 }], tags: ['magic'], description: 'Detonate runic force on an area of foes.' },
  passive('runic-edge', 'Runic Edge', 'support', [{ type: 'damage-boost', pct: 0.15 }], '+15% damage with everything.'),
  { id: 'runic-storm', name: 'Runic Storm', kind: 'ultimate', cost: ULT, chargeTicks: 5, range: R(1, 4), area: { shape: 'diamond', size: 2 }, affects: 'foes', effects: [{ type: 'damage', stat: 'mag', power: 1.8 }], tags: ['magic'], description: 'A storm of runes on a wide area of foes.' },

  // ===== Enemy-only abilities (tier 0 jobs) =====
  { id: 'rend', name: 'Rend', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 1.1 }, { type: 'status', status: 'poison', chance: 0.4, duration: 2 }], tags: ['physical', 'melee'], description: 'A tearing strike that may fester.' },
  { id: 'raise-dead', name: 'Raise Dead', kind: 'action', cost: { mp: 10 }, range: R(1, 3), area: SINGLE, effects: [{ type: 'summon', job: 'grunt', name: 'Risen' }], tags: ['magic', 'dark'], description: 'Call a skeleton up out of the ground.' },
  { id: 'dark-bolt', name: 'Dark Bolt', kind: 'action', cost: { mp: 4 }, range: R(1, 4), area: SINGLE, effects: [{ type: 'damage', stat: 'mag', power: 1.2, element: 'dark' }], tags: ['magic', 'dark'], description: 'A bolt of shadow.' },
  { id: 'chill-touch', name: 'Chill Touch', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'mag', power: 1, element: 'ice' }, { type: 'status', status: 'slow', chance: 0.6, duration: 2 }], tags: ['magic', 'ice'], description: 'A freezing touch that may slow.' },
  { id: 'infectious-bite', name: 'Infectious Bite', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 0.9 }, { type: 'status', status: 'poison', chance: 0.9, duration: 3 }], tags: ['physical', 'melee'], description: 'A bite that poisons.' },
  { id: 'ground-slam', name: 'Ground Slam', kind: 'action', cost: { mp: 4 }, range: SELF, area: CROSS1, affects: 'foes', effects: [{ type: 'damage', stat: 'atk', power: 1 }, { type: 'push', distance: 1 }], tags: ['physical'], description: 'Slam the ground: damage and knock back everything adjacent.' },
  { id: 'shield-bash', name: 'Shield Bash', kind: 'action', range: MELEE, area: SINGLE, effects: [{ type: 'damage', stat: 'atk', power: 0.8 }, { type: 'push', distance: 1 }], tags: ['physical', 'melee'], description: 'Shove a foe back with a shield.' },
  { id: 'fireball', name: 'Fireball', kind: 'action', cost: { mp: 6 }, range: R(1, 4), area: CROSS1, effects: [{ type: 'damage', stat: 'mag', power: 1, element: 'fire' }], tags: ['magic', 'fire'], description: 'A ball of fire bursting in a cross.' },

  // --- Consumables (src/data/items.ts): any unit can use one from the shared inventory ---
  {
    id: 'use-potion', name: 'Potion', kind: 'action', cost: { item: 'potion' },
    range: { min: 0, max: 1, los: false }, area: SINGLE,
    effects: [{ type: 'heal', flat: 30 }],
    tags: ['item', 'throw'], description: 'Restore 30 HP.',
  },
  {
    id: 'use-ether', name: 'Ether', kind: 'action', cost: { item: 'ether' },
    range: { min: 0, max: 1, los: false }, area: SINGLE,
    effects: [{ type: 'mp', amount: 15 }],
    tags: ['item', 'throw'], description: 'Restore 15 MP.',
  },
  {
    id: 'use-antidote', name: 'Antidote', kind: 'action', cost: { item: 'antidote' },
    range: { min: 0, max: 1, los: false }, area: SINGLE,
    effects: [{ type: 'cleanse' }],
    tags: ['item', 'throw'], description: 'Remove all statuses.',
  },
  {
    id: 'use-phoenix', name: 'Phoenix Feather', kind: 'action', cost: { item: 'phoenix-feather' },
    range: { min: 1, max: 1, los: false }, area: SINGLE,
    effects: [{ type: 'revive', hpPct: 0.3 }],
    tags: ['item', 'throw'], description: 'Revive a downed ally with 30% HP.',
  },

  // --- Cross-player combos (docs/DESIGN.md §6.6) ---
  {
    id: 'pincer', name: 'Pincer', kind: 'combo', range: SELF, area: SINGLE, effects: [],
    trigger: { type: 'flank', crossPlayer: true }, tags: [],
    description: "Two players' units hit the same foe from opposite sides in one phase: the second hit counts as from behind.",
  },
  {
    id: 'aegis-link', name: 'Aegis Link', kind: 'combo', range: SELF, area: SINGLE, effects: [],
    trigger: { type: 'heal-guard', tag: 'holy', crossPlayer: true }, tags: [],
    description: "A holy heal lands next to another player's unit with Cover: the heal is mirrored onto it.",
  },
  {
    id: 'volley-mark', name: 'Volley Mark', kind: 'combo', range: SELF, area: SINGLE, effects: [],
    trigger: { type: 'marked-shot', tag: 'bow', status: 'mark', crossPlayer: true }, tags: [],
    description: "A bow shot at a foe another player Marked can't miss.",
  },
  {
    id: 'ignite', name: 'Ignite', kind: 'combo', range: SELF, area: { shape: 'diamond', size: 2 },
    trigger: { type: 'element-on-hazard', element: 'fire', hazard: 'oil', crossPlayer: true },
    effects: [
      { type: 'damage', stat: 'mag', power: 1, element: 'fire' },
      { type: 'hazard', hazard: 'fire', rounds: 2 },
    ],
    tags: ['magic', 'fire'],
    description: "Fire hits another player's oil: it explodes in a radius-2 blast and burns for 2 rounds.",
  },
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(defs.map((a) => [a.id, a]));
