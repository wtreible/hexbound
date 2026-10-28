// Shrine events (docs/DESIGN.md §5.1: "a random event with a choice"). Pure data;
// rules/run.ts applies the outcomes. Gold costs are negative gold outcomes and
// make a choice unavailable when the party can't pay.

export type ShrineOutcome =
  | { type: 'gold'; amount: number }
  /** Heal (positive) or hurt (negative) every unit by a share of max HP. Hurting never drops below 1 HP. */
  | { type: 'hp'; pct: number }
  /** JP for every unit's current job. */
  | { type: 'jp'; amount: number }
  | { type: 'item'; itemId: string; count?: number }
  /** One level for a random unit. */
  | { type: 'level' };

export type ShrineChoice = { label: string; outcomes: ShrineOutcome[]; result: string };
export type ShrineEvent = {
  id: string;
  title: string;
  text: string;
  choices: ShrineChoice[];
  /** Profile milestone that adds this event to the pool (decision 0024). */
  unlock?: 'first-run' | 'first-win';
};

export const SHRINES: ShrineEvent[] = [
  {
    id: 'wayside-shrine', title: 'Wayside Shrine', text: 'A moss-covered shrine stands at a crossroads. Candles still burn.',
    choices: [
      { label: 'Pray (heal 30%)', outcomes: [{ type: 'hp', pct: 0.3 }], result: 'A quiet warmth settles over the company.' },
      { label: 'Leave an offering (30 gold): someone grows stronger', outcomes: [{ type: 'gold', amount: -30 }, { type: 'level' }], result: 'One of you feels the shrine answer.' },
      { label: 'Walk on', outcomes: [], result: 'You leave the candles burning.' },
    ],
  },
  {
    id: 'abandoned-cart', title: 'Abandoned Cart', text: 'An overturned cart blocks the road. Its strongbox is still locked.',
    choices: [
      { label: 'Force the strongbox (+40 gold, hurt 10%)', outcomes: [{ type: 'gold', amount: 40 }, { type: 'hp', pct: -0.1 }], result: 'A needle trap bites, but the gold is real.' },
      { label: 'Leave it', outcomes: [], result: 'Someone else can spring that trap.' },
    ],
  },
  {
    id: 'drillmaster', title: 'Old Drillmaster', text: 'A retired sergeant offers to put the company through its paces.',
    choices: [
      { label: 'Train hard (+40 JP, hurt 15%)', outcomes: [{ type: 'jp', amount: 40 }, { type: 'hp', pct: -0.15 }], result: 'Bruised, but sharper for it.' },
      { label: 'Share a meal instead (heal 20%)', outcomes: [{ type: 'hp', pct: 0.2 }], result: 'War stories and stew.' },
    ],
  },
  {
    id: 'peddler', title: 'Wandering Peddler', text: 'A peddler with a too-large pack waves you over.',
    choices: [
      { label: 'Buy a Phoenix Feather (30 gold)', outcomes: [{ type: 'gold', amount: -30 }, { type: 'item', itemId: 'phoenix-feather' }], result: 'The feather is warm to the touch.' },
      { label: 'Trade stories (+10 JP)', outcomes: [{ type: 'jp', amount: 10 }], result: 'You learn a trick or two.' },
    ],
  },
  {
    id: 'cursed-idol', title: 'Cursed Idol', text: 'A gold idol grins from a niche in the rock. The air around it is cold.',
    choices: [
      { label: 'Take it (+80 gold, hurt 25%)', outcomes: [{ type: 'gold', amount: 80 }, { type: 'hp', pct: -0.25 }], result: 'The cold follows you for a while.' },
      { label: 'Smash it (+20 JP)', outcomes: [{ type: 'jp', amount: 20 }], result: 'The curse breaks with a sigh.' },
    ],
  },
  {
    id: 'healing-spring', title: 'Healing Spring', text: 'Clear water bubbles up between white stones.',
    choices: [
      { label: 'Drink (heal 50%)', outcomes: [{ type: 'hp', pct: 0.5 }], result: 'Wounds close and spirits lift.' },
      { label: 'Fill flasks (2 Potions)', outcomes: [{ type: 'item', itemId: 'potion', count: 2 }], result: 'The flasks will keep.' },
    ],
  },
  {
    id: 'wandering-master', title: 'Wandering Master', text: 'An old swordmaster offers a lesson to one of you, for a price.', unlock: 'first-run',
    choices: [
      { label: 'Pay for the lesson (40 gold, +60 JP)', outcomes: [{ type: 'gold', amount: -40 }, { type: 'jp', amount: 60 }], result: 'Hard lessons, well learned.' },
      { label: 'Watch from a distance (+15 JP)', outcomes: [{ type: 'jp', amount: 15 }], result: 'You pick up a little.' },
    ],
  },
  {
    id: 'hexstone', title: 'The Hexstone', text: 'A black stone hums with the same curse that binds your company.', unlock: 'first-win',
    choices: [
      { label: 'Touch it (a level for one of you, hurt 20%)', outcomes: [{ type: 'level' }, { type: 'hp', pct: -0.2 }], result: 'Power, and a chill that lingers.' },
      { label: 'Leave it be', outcomes: [], result: 'Some things are better left alone.' },
    ],
  },
];
