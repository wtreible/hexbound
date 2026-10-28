import type { MapTemplate } from './meadow';

// Underground crypt: '6' is wall and pillar. Steps lead down from the south
// entrance to a pillared hall, a western side passage and the burial vault.
export const crypt: MapTemplate = {
  id: 'crypt',
  name: 'Sunken Crypt',
  rows: [
    '666666666666',
    '600000000006',
    '601106601106',
    '600006600006',
    '666006600666',
    '000000000006',
    '001100001106',
    '600000000006',
    '666600006666',
    '666611116666',
    '666622226666',
    '333333333333',
  ],
  spawns: {
    player: [{ x: 4, y: 11 }, { x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }],
    enemy: [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }],
  },
  exits: [{ x: 0, y: 5 }, { x: 0, y: 6 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 3, y: 11 },
};
