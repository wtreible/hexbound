import { ITEMS, type ItemDef } from '../data/items';
import { ability, jobOf } from './jobs';
import type { AbilityDef, GearSlot, Unit } from './types';

// Gear and consumables (decision 0016). Gear adds flat stats; consumables are
// shared by the party and used through their ability.

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'accessory'];

export function item(id: string): ItemDef {
  const i = ITEMS[id];
  if (!i) throw new Error(`unknown item ${id}`);
  return i;
}

/** Whether the unit's current job can use the item in that slot. */
export function canEquip(unit: Unit, itemId: string, slot: GearSlot): boolean {
  const i = item(itemId);
  if (i.kind !== slot) return false;
  return slot !== 'weapon' || (!!i.tag && jobOf(unit).equip.includes(i.tag));
}

/** Consumables the party holds, as usable abilities with their counts. */
export function itemAbilities(inventory: Record<string, number>): { ability: AbilityDef; itemId: string; count: number }[] {
  return Object.entries(inventory)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => ({ ability: ability(item(itemId).ability!), itemId, count }));
}
