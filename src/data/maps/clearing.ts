import type { MapTemplate } from './meadow';

// Open forest clearing ringed by high rock, with three outcrops that can be
// climbed from one side and drop as cliffs on the others.
export const clearing: MapTemplate = {
  id: 'clearing',
  name: 'Thornwood Clearing',
  rows: [
    '6541000001456',
    '5410000000145',
    '4200011000024',
    '1000135300001',
    '0000136500000',
    '0000002000000',
    '0000000000000',
    '0000000000000',
    '0000000013500',
    '0130000003640',
    '1354000000100',
    '2410000000001',
    '4200000000012',
  ],
  spawns: {
    player: [{ x: 8, y: 12 }, { x: 9, y: 12 }, { x: 10, y: 12 }, { x: 9, y: 11 }],
    enemy: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 4, y: 1 }, { x: 5, y: 1 }],
  },
  exits: [{ x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 }],
  hold: [{ x: 6, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 7 }, { x: 7, y: 7 }],
  vip: { x: 11, y: 12 },
};
