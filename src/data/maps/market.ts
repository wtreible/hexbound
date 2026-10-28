import type { MapTemplate } from './meadow';

// Split-level town square: an upper plaza lined with buildings ('6') looks
// down on the market and fountain; two stairways join the levels.
export const market: MapTemplate = {
  id: 'market',
  name: 'Market Square',
  rows: [
    '66333333336633',
    '66333344336633',
    '33333344333333',
    '33366333336633',
    '33366333336633',
    '33333333333333',
    '00020000000200',
    '00000~~0000000',
    '06600~~0000660',
    '06600000000660',
    '00000000000000',
    '00110000001100',
  ],
  spawns: {
    player: [{ x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 8, y: 11 }],
    enemy: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }],
  },
  exits: [{ x: 12, y: 0 }, { x: 13, y: 0 }, { x: 12, y: 1 }, { x: 13, y: 1 }],
  hold: [{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
  vip: { x: 4, y: 11 },
};
