import type { MapTemplate } from './meadow';

// Flat graveyard dotted with low burial mounds and a central barrow.
export const barrows: MapTemplate = {
  id: 'barrows',
  name: 'Barrow Field',
  rows: [
    '0001000100010',
    '0012100000000',
    '0001000121000',
    '0000000010000',
    '0100100000100',
    '1210000110121',
    '0100001221010',
    '0000000110000',
    '0010010000100',
    '0121000001210',
    '0010000000100',
    '0000001000000',
  ],
  spawns: {
    player: [{ x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 0, y: 10 }],
    enemy: [{ x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 12, y: 0 }],
  },
  exits: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  hold: [{ x: 7, y: 6 }, { x: 8, y: 6 }],
  vip: { x: 3, y: 11 },
};
