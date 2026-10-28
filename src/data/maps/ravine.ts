import type { MapTemplate } from './meadow';

// A single stone bridge spans a flooded ravine; the banks rise to a crest on each side.
export const ravine: MapTemplate = {
  id: 'ravine',
  name: 'Ravine Bridge',
  rows: [
    '222233332222',
    '222223322222',
    '112222222211',
    '011222222110',
    '001122222100',
    '~~~~~22~~~~~',
    '~~~~~22~~~~~',
    '000122221000',
    '001222222100',
    '012222222210',
    '112222222211',
    '122222222221',
  ],
  spawns: {
    player: [{ x: 4, y: 11 }, { x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }],
    enemy: [{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }],
  },
  exits: [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 1 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
  vip: { x: 5, y: 10 },
};
