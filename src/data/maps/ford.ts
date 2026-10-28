import type { MapTemplate } from './meadow';

// A river runs north to south; two shallow fords cross it, the middle one
// being the hold point.
export const ford: MapTemplate = {
  id: 'ford',
  name: 'Willow Ford',
  rows: [
    '22211~~~11122',
    '22111~~~01122',
    '1110000000111',
    '21100~~~00112',
    '1210~~~~00111',
    '2210~~~~01121',
    '1100000000011',
    '2110~~~~00112',
    '1110~~~000112',
    '1221~~~~01221',
    '1110~~~~00111',
    '2221~~~~01222',
  ],
  spawns: {
    player: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 11 }],
    enemy: [{ x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 12, y: 0 }, { x: 11, y: 1 }],
  },
  exits: [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 12, y: 10 }],
  hold: [{ x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }],
  vip: { x: 0, y: 11 },
};
