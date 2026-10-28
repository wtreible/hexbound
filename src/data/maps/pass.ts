import type { MapTemplate } from './meadow';

// Mountain pass: a valley climbs from both ends to a narrow saddle between
// rock walls, with ledges on the flanks.
export const pass: MapTemplate = {
  id: 'pass',
  name: 'Highmoor Pass',
  rows: [
    '997322223799',
    '976432234679',
    '975443344579',
    '986544445689',
    '998654456899',
    '999865568999',
    '999865568999',
    '998654456899',
    '986544445689',
    '975433334579',
    '964322223469',
    '963211112369',
    '963211112369',
  ],
  spawns: {
    player: [{ x: 4, y: 12 }, { x: 5, y: 12 }, { x: 6, y: 12 }, { x: 7, y: 12 }],
    enemy: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }],
  },
  exits: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 5, y: 11 },
};
