import type { AbilityDef } from '../rules/types';

// Ability definitions (docs/DESIGN.md §6.3, §8). Pure data: every behaviour comes
// from the effect pipeline in rules/abilities.ts.

const MELEE = { min: 1, max: 1, los: false } as const;
const SINGLE = { shape: 'single', size: 0 } as const;

const defs: AbilityDef[] = [
  // Basic attacks
  {
    id: 'strike', name: 'Strike', kind: 'action', range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1 }],
    tags: ['physical'], description: 'A plain weapon attack.',
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
    tags: ['physical'], description: 'A light staff blow.',
  },

  // Squire
  {
    id: 'rally-strike', name: 'Rally Strike', kind: 'action', cost: { mp: 3 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 1.4 }],
    tags: ['physical'], description: 'A heavy committed blow.',
  },
  {
    id: 'guard', name: 'Guard', kind: 'action', range: { min: 0, max: 0, los: false }, area: SINGLE,
    effects: [{ type: 'status', status: 'guard', chance: 1, duration: 1 }],
    tags: [], description: 'Raise defence by half until your next turn.',
  },
  {
    id: 'shove', name: 'Shove', kind: 'action', cost: { mp: 2 }, range: MELEE, area: SINGLE,
    effects: [{ type: 'damage', stat: 'atk', power: 0.6 }, { type: 'push', distance: 1 }],
    tags: ['physical'], description: 'A light hit that knocks the target back one tile.',
  },

  // Archer
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

  // Acolyte
  {
    id: 'mend', name: 'Mend', kind: 'action', cost: { mp: 4 },
    range: { min: 0, max: 3, los: false }, area: SINGLE,
    effects: [{ type: 'heal', stat: 'mag', power: 0.8 }],
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
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(defs.map((a) => [a.id, a]));
