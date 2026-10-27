import type { AbilityDef } from '../rules/types';

// Ability definitions (docs/DESIGN.md §6.3, §6.4, §8). Pure data: every
// behaviour comes from the effect pipeline in rules/abilities.ts and the
// passive handling in rules/jobs.ts.

const MELEE = { min: 1, max: 1, los: false } as const;
const SELF = { min: 0, max: 0, los: false } as const;
const SINGLE = { shape: 'single', size: 0 } as const;
const ULT = { resolve: 100 } as const;

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
    id: 'counter', name: 'Counter', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    id: 'eagle-eye', name: 'Eagle Eye', kind: 'passive', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'range', tag: 'bow', add: 1 }], tags: [], description: '+1 range with bows.',
  },
  {
    id: 'rain-of-arrows', name: 'Rain of Arrows', kind: 'ultimate', cost: ULT,
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
    id: 'mana-well', name: 'Mana Well', kind: 'passive', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'mp-regen', amount: 3 }], tags: [], description: 'Recover 3 MP at the start of each turn.',
  },
  {
    id: 'meteor', name: 'Meteor', kind: 'ultimate', cost: ULT,
    range: { min: 2, max: 5, los: false }, area: { shape: 'diamond', size: 1 },
    effects: [{ type: 'damage', stat: 'mag', power: 2.2, element: 'fire' }],
    tags: ['magic', 'fire'], description: 'A falling star. Hits everything in the area, allies included.',
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
    id: 'grace', name: 'Grace', kind: 'passive', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'heal-boost', pct: 0.2 }], tags: [], description: 'Your healing is 20% stronger.',
  },
  {
    id: 'sanctuary', name: 'Sanctuary', kind: 'ultimate', cost: ULT,
    range: SELF, area: { shape: 'diamond', size: 2 }, affects: 'allies',
    effects: [{ type: 'heal', power: 1 }, { type: 'cleanse' }],
    tags: ['magic', 'holy'], description: 'Heal and cleanse every ally within 2 tiles.',
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
    id: 'fleet', name: 'Fleet', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    id: 'throw-range', name: 'Throw Range +2', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    effects: [{ type: 'damage', stat: 'mag', power: 1.4, element: 'holy' }],
    tags: ['magic', 'holy'], description: 'Holy light strikes a nearby foe.',
  },
  {
    id: 'consecrate', name: 'Consecrate', kind: 'action', cost: { mp: 6 },
    range: SELF, area: { shape: 'diamond', size: 1 }, affects: 'allies',
    effects: [{ type: 'heal', power: 0.6 }],
    tags: ['magic', 'holy'], description: 'Heal yourself and adjacent allies.',
  },
  {
    id: 'cover', name: 'Cover', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    id: 'arcane-edge', name: 'Arcane Edge', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    id: 'foresight', name: 'Foresight', kind: 'passive', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'evade', add: 10 }], tags: [], description: '+10 evade.',
  },
  {
    id: 'stasis', name: 'Stasis', kind: 'ultimate', cost: ULT,
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
    id: 'pathfinder', name: 'Pathfinder', kind: 'passive', range: SELF, area: SINGLE, effects: [],
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
    effects: [{ type: 'status', status: 'poison', chance: 0.9, duration: 3 }],
    tags: ['throw'], description: 'A cloud that poisons everyone inside, allies included.',
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
    id: 'elusive', name: 'Elusive', kind: 'passive', range: SELF, area: SINGLE, effects: [],
    passive: [{ type: 'stat', stat: 'evade', add: 10 }], tags: [], description: '+10 evade.',
  },
  {
    id: 'scorched-earth', name: 'Scorched Earth', kind: 'ultimate', cost: ULT,
    range: { min: 1, max: 3, los: false }, area: { shape: 'diamond', size: 2 }, affects: 'foes',
    effects: [
      { type: 'damage', stat: 'mag', power: 0.8, element: 'fire' },
      { type: 'hazard', hazard: 'fire', rounds: 2 },
    ],
    tags: ['magic', 'fire'], description: 'Set a wide area ablaze for two rounds.',
  },

  // --- Cross-player combos (docs/DESIGN.md §6.6) ---
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
