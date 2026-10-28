import type { MapTemplate } from './meadow';

// Cave system: '9' is solid rock. Two narrow tunnels join the north and south
// chambers through a central cavern, with a side tunnel out to the east.
export const caves: MapTemplate = {
  id: 'caves',
  name: 'Hollow Caves',
  rows: [
    '9991111111999',
    '9911121111199',
    '9911111111199',
    '9919999991999',
    '9919999991999',
    '9911122211111',
    '9911123211911',
    '9919999991999',
    '9919999991999',
    '9911111111199',
    '9911111111199',
    '9991111111999',
  ],
  spawns: {
    player: [{ x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 }],
    enemy: [{ x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }],
  },
  exits: [{ x: 11, y: 5 }, { x: 12, y: 5 }, { x: 11, y: 6 }, { x: 12, y: 6 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 6, y: 11 },
};
