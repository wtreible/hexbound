import type { JobId } from '../rules/types';

// How each job looks (docs/DESIGN.md §9.2, decision 0021). A look is a body
// from public/models/manifest.json, which of its built-in props to show
// (weapons, hats, capes), weapons to attach to the hand bones, and a tint.
// Hybrids use one parent's body with the other parent's gear. Enemies are
// skeletons chosen by job type.

export type Look = {
  body: string;
  /** Built-in rigid props to show; every other prop on the body is hidden. */
  props: string[];
  /** Weapon keys from the manifest, attached to the hand bones. */
  attach?: { right?: string; left?: string };
  /** Multiplied into the body's colours, for job variety. */
  tint?: number;
};

export const PLAYER_LOOKS: Record<JobId, Look> = {
  squire: { body: 'knight', props: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'] },
  archer: { body: 'rogue', props: ['2H_Crossbow', 'Rogue_Cape'], tint: 0xd8e8c8 },
  mage: { body: 'mage', props: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'] },
  acolyte: { body: 'mage', props: ['1H_Wand', 'Spellbook_open', 'Mage_Cape'], tint: 0xfff4e0 },
  thief: { body: 'rogue_hooded', props: ['Knife', 'Knife_Offhand', 'Rogue_Cape'] },
  chemist: { body: 'barbarian', props: ['Mug', 'Barbarian_Hat'], tint: 0xe0f0d8 },
  // Hybrids: one parent's body, the other parent's gear.
  paladin: { body: 'knight', props: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], tint: 0xfff0d0 },
  spellblade: { body: 'knight', props: ['2H_Sword', 'Knight_Cape'], tint: 0xe0d0f0 },
  oracle: { body: 'mage', props: ['2H_Staff', 'Spellbook_open', 'Mage_Hat'], tint: 0xd0ecec },
  ranger: { body: 'rogue_hooded', props: ['1H_Crossbow', 'Knife_Offhand', 'Rogue_Cape'], tint: 0xd8e8c8 },
  saboteur: { body: 'rogue_hooded', props: ['Throwable', 'Knife'], tint: 0xc8c0b8 },
};

const warrior: Look = { body: 'skeleton_warrior', props: ['Skeleton_Warrior_Helmet'], attach: { right: 'sword', left: 'shield' } };
const archer: Look = { body: 'skeleton_rogue', props: ['Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape'], attach: { right: 'crossbow' } };
const caster: Look = { body: 'skeleton_mage', props: ['Skeleton_Mage_Hat'], attach: { right: 'staff' } };
const minion: Look = { body: 'skeleton_minion', props: [], attach: { right: 'dagger' } };

export const ENEMY_LOOKS: Record<JobId, Look> = {
  squire: warrior,
  paladin: warrior,
  spellblade: warrior,
  archer,
  ranger: archer,
  mage: caster,
  acolyte: caster,
  oracle: caster,
  thief: minion,
  saboteur: minion,
  chemist: minion,
};

/** The escorted Pilgrim. */
export const NPC_LOOK: Look = { body: 'barbarian', props: ['Mug', 'Barbarian_Hat'], tint: 0xf0e0c0 };
