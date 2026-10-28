import type { MapTemplate } from './meadow';

// Flooded marsh: grassy islands strung together by thin causeways.
export const marsh: MapTemplate = {
  id: 'marsh',
  name: 'Sunken Marsh',
  rows: [
    '1100~~~~~0011',
    '1110~~0~~0111',
    '0110~000~~011',
    '~0~~~0~0~~~0~',
    '~00~~0~00~~0~',
    '~~0000~~0000~',
    '~~0~~0110~0~~',
    '~00~~0110~00~',
    '~0~~~0~~~~~0~',
    '000~~000~~000',
    '1100~~0~~0011',
    '1110~~~~~0111',
  ],
  spawns: {
    player: [{ x: 0, y: 11 }, { x: 1, y: 11 }, { x: 2, y: 11 }, { x: 0, y: 10 }],
    enemy: [{ x: 11, y: 0 }, { x: 12, y: 0 }, { x: 10, y: 1 }, { x: 11, y: 1 }, { x: 12, y: 1 }],
  },
  exits: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  hold: [{ x: 6, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 7 }, { x: 7, y: 7 }],
  vip: { x: 1, y: 10 },
};
