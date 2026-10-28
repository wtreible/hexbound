// Starting relics (docs/DESIGN.md §6.7; decision 0024): minor perks chosen at
// the squad draft, unlocked by milestones across runs. They widen options
// rather than inflate power.

export type RelicEffect =
  | { type: 'none' }
  | { type: 'item'; itemId: string; count: number }
  | { type: 'gold'; amount: number }
  | { type: 'gear' }
  | { type: 'level' }
  | { type: 'second-ability' };

export type Relic = {
  id: string;
  name: string;
  description: string;
  effect: RelicEffect;
  /** How it's unlocked; absent = available from the start. */
  unlock?: { kind: 'runs' | 'wins' | 'boss' | 'act' | 'advanced-mastery'; value?: number | string; hint: string };
};

export const RELICS: Relic[] = [
  { id: 'none', name: 'No relic', description: 'Travel light.', effect: { type: 'none' } },
  { id: 'travelers-pack', name: "Traveler's Pack", description: 'Start with 2 extra Potions.', effect: { type: 'item', itemId: 'potion', count: 2 } },
  { id: 'coin-purse', name: 'Coin Purse', description: 'Start with 60 extra gold.', effect: { type: 'gold', amount: 60 }, unlock: { kind: 'runs', value: 1, hint: 'Finish a run.' } },
  { id: 'whetstone', name: "Smith's Whetstone", description: 'Start with a random tier 1 weapon in the stash.', effect: { type: 'gear' }, unlock: { kind: 'boss', value: '1-boss', hint: 'Defeat the Bandit Chief.' } },
  { id: 'phoenix-charm', name: 'Phoenix Charm', description: 'Start with a Phoenix Feather.', effect: { type: 'item', itemId: 'phoenix-feather', count: 1 }, unlock: { kind: 'act', value: 3, hint: 'Reach act 3.' } },
  { id: 'scholars-tome', name: "Scholar's Tome", description: "Every unit starts knowing its job's second action too.", effect: { type: 'second-ability' }, unlock: { kind: 'advanced-mastery', hint: 'Master an advanced job.' } },
  { id: 'veterans-banner', name: "Veteran's Banner", description: 'The squad starts at level 2.', effect: { type: 'level' }, unlock: { kind: 'wins', value: 1, hint: 'Win a run.' } },
];
