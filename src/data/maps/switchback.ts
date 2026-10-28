import type { MapTemplate } from './meadow';

// Cliffside switchback: three ledges stacked three tiers apart, joined only at
// alternating ends, climb from the shore to the clifftop.
export const switchback: MapTemplate = {
  id: 'switchback',
  name: 'Cliffside Switchback',
  rows: [
    '999999999999',
    '999999999999',
    '999999999999',
    '666666666667',
    '666666666667',
    '433333333333',
    '433333333333',
    '000000000001',
    '000000000001',
    '000000000000',
    '0000~~~~~~~~',
    '000~~~~~~~~~',
  ],
  spawns: {
    player: [{ x: 0, y: 9 }, { x: 1, y: 9 }, { x: 0, y: 10 }, { x: 1, y: 10 }],
    enemy: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  },
  exits: [{ x: 1, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 5 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 2, y: 9 },
};
