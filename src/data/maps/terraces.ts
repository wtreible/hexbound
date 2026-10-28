import type { MapTemplate } from './meadow';

// Terraced hillside: three-tier walls between the bands, one ramp per terrace,
// alternating sides so the climb zig-zags.
export const terraces: MapTemplate = {
  id: 'terraces',
  name: 'Terraced Hillside',
  rows: [
    '999999999999',
    '999999999999',
    '666666666688',
    '666667766666',
    '666666666666',
    '443333333333',
    '333333333333',
    '333333333333',
    '000001100000',
    '001000000110',
    '012100001221',
    '001000000110',
  ],
  spawns: {
    player: [{ x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 0, y: 10 }],
    enemy: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }],
  },
  exits: [{ x: 11, y: 6 }, { x: 11, y: 7 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 3, y: 11 },
};
