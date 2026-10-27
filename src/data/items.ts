import type { EquipTag, GearSlot, Stat } from '../rules/types';

// Gear and consumables (docs/DESIGN.md §5.1: Shop, Camp; decision 0016).
// Gear adds flat stats after job multipliers. A weapon needs a tag the
// wearer's job can equip; armor and accessories fit anyone. Consumables are
// used in battle through their `ability` (src/data/abilities.ts).

export type ItemKind = GearSlot | 'consumable';

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  /** Act whose shops stock it. */
  tier: 1 | 2 | 3;
  price: number;
  /** Weapons only: must be in the job's `equip` list. */
  tag?: EquipTag;
  stats?: Partial<Record<Stat, number>>;
  /** Consumables only: the ability used in battle. */
  ability?: string;
  description: string;
};

const defs: ItemDef[] = [
  // --- Consumables ---
  { id: 'potion', name: 'Potion', kind: 'consumable', tier: 1, price: 15, ability: 'use-potion', description: 'Restores 30 HP. Range 1.' },
  { id: 'ether', name: 'Ether', kind: 'consumable', tier: 1, price: 25, ability: 'use-ether', description: 'Restores 15 MP. Range 1.' },
  { id: 'antidote', name: 'Antidote', kind: 'consumable', tier: 1, price: 10, ability: 'use-antidote', description: 'Removes all statuses. Range 1.' },
  { id: 'phoenix-feather', name: 'Phoenix Feather', kind: 'consumable', tier: 1, price: 40, ability: 'use-phoenix', description: 'Revives a downed ally with 30% HP. Range 1.' },

  // --- Weapons, tier 1 ---
  { id: 'iron-sword', name: 'Iron Sword', kind: 'weapon', tag: 'sword', tier: 1, price: 45, stats: { atk: 3 }, description: '+3 ATK.' },
  { id: 'hunting-bow', name: 'Hunting Bow', kind: 'weapon', tag: 'bow', tier: 1, price: 45, stats: { atk: 3 }, description: '+3 ATK.' },
  { id: 'oak-staff', name: 'Oak Staff', kind: 'weapon', tag: 'staff', tier: 1, price: 45, stats: { mag: 3, atk: 1 }, description: '+3 MAG, +1 ATK.' },
  { id: 'ember-rod', name: 'Ember Rod', kind: 'weapon', tag: 'rod', tier: 1, price: 50, stats: { mag: 4 }, description: '+4 MAG.' },
  { id: 'dirk', name: 'Dirk', kind: 'weapon', tag: 'dagger', tier: 1, price: 40, stats: { atk: 2, evade: 3 }, description: '+2 ATK, +3 evade.' },
  { id: 'flintlock', name: 'Flintlock', kind: 'weapon', tag: 'gun', tier: 1, price: 55, stats: { atk: 4 }, description: '+4 ATK.' },
  // --- Weapons, tier 2 ---
  { id: 'steel-sword', name: 'Steel Sword', kind: 'weapon', tag: 'sword', tier: 2, price: 100, stats: { atk: 6 }, description: '+6 ATK.' },
  { id: 'longbow', name: 'Longbow', kind: 'weapon', tag: 'bow', tier: 2, price: 100, stats: { atk: 6 }, description: '+6 ATK.' },
  { id: 'rune-staff', name: 'Rune Staff', kind: 'weapon', tag: 'staff', tier: 2, price: 100, stats: { mag: 6, mp: 4 }, description: '+6 MAG, +4 MP.' },
  { id: 'ash-rod', name: 'Ash Rod', kind: 'weapon', tag: 'rod', tier: 2, price: 110, stats: { mag: 7 }, description: '+7 MAG.' },
  { id: 'kris', name: 'Kris', kind: 'weapon', tag: 'dagger', tier: 2, price: 95, stats: { atk: 5, evade: 5 }, description: '+5 ATK, +5 evade.' },
  { id: 'blunderbuss', name: 'Blunderbuss', kind: 'weapon', tag: 'gun', tier: 2, price: 115, stats: { atk: 7 }, description: '+7 ATK.' },
  // --- Weapons, tier 3 ---
  { id: 'mythril-sword', name: 'Mythril Sword', kind: 'weapon', tag: 'sword', tier: 3, price: 200, stats: { atk: 10 }, description: '+10 ATK.' },
  { id: 'elven-bow', name: 'Elven Bow', kind: 'weapon', tag: 'bow', tier: 3, price: 200, stats: { atk: 10, spd: 1 }, description: '+10 ATK, +1 SPD.' },
  { id: 'sage-staff', name: 'Sage Staff', kind: 'weapon', tag: 'staff', tier: 3, price: 200, stats: { mag: 10, mp: 8 }, description: '+10 MAG, +8 MP.' },
  { id: 'star-rod', name: 'Star Rod', kind: 'weapon', tag: 'rod', tier: 3, price: 210, stats: { mag: 12 }, description: '+12 MAG.' },
  { id: 'assassin-blade', name: "Assassin's Blade", kind: 'weapon', tag: 'dagger', tier: 3, price: 190, stats: { atk: 8, evade: 10 }, description: '+8 ATK, +10 evade.' },
  { id: 'hand-cannon', name: 'Hand Cannon', kind: 'weapon', tag: 'gun', tier: 3, price: 220, stats: { atk: 12 }, description: '+12 ATK.' },

  // --- Armor ---
  { id: 'leather-vest', name: 'Leather Vest', kind: 'armor', tier: 1, price: 40, stats: { def: 2, hp: 5 }, description: '+2 DEF, +5 HP.' },
  { id: 'cloth-robe', name: 'Cloth Robe', kind: 'armor', tier: 1, price: 40, stats: { res: 3, mp: 5 }, description: '+3 RES, +5 MP.' },
  { id: 'chain-shirt', name: 'Chain Shirt', kind: 'armor', tier: 2, price: 95, stats: { def: 5, hp: 10 }, description: '+5 DEF, +10 HP.' },
  { id: 'silk-robe', name: 'Silk Robe', kind: 'armor', tier: 2, price: 95, stats: { res: 6, mp: 8 }, description: '+6 RES, +8 MP.' },
  { id: 'plate', name: 'Plate', kind: 'armor', tier: 3, price: 190, stats: { def: 9, hp: 18 }, description: '+9 DEF, +18 HP.' },
  { id: 'archmage-robe', name: 'Archmage Robe', kind: 'armor', tier: 3, price: 190, stats: { res: 10, mp: 12, mag: 2 }, description: '+10 RES, +12 MP, +2 MAG.' },

  // --- Accessories ---
  { id: 'feather-charm', name: 'Feather Charm', kind: 'accessory', tier: 1, price: 35, stats: { jump: 1 }, description: '+1 jump.' },
  { id: 'ward-ring', name: 'Ward Ring', kind: 'accessory', tier: 1, price: 35, stats: { res: 4 }, description: '+4 RES.' },
  { id: 'swift-boots', name: 'Swift Boots', kind: 'accessory', tier: 2, price: 120, stats: { move: 1 }, description: '+1 move.' },
  { id: 'power-ring', name: 'Power Ring', kind: 'accessory', tier: 2, price: 90, stats: { atk: 3, mag: 3 }, description: '+3 ATK, +3 MAG.' },
  { id: 'hawk-eye', name: 'Hawk Eye', kind: 'accessory', tier: 2, price: 90, stats: { evade: 10 }, description: '+10 evade.' },
  { id: 'guardian-amulet', name: 'Guardian Amulet', kind: 'accessory', tier: 3, price: 180, stats: { def: 4, res: 4, hp: 10 }, description: '+4 DEF, +4 RES, +10 HP.' },
  { id: 'crown-of-focus', name: 'Crown of Focus', kind: 'accessory', tier: 3, price: 180, stats: { mag: 5, mp: 10 }, description: '+5 MAG, +10 MP.' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((i) => [i.id, i]));
