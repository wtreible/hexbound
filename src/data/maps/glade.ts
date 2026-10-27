import type { MapTemplate } from './meadow';

// TEMPORARY test map (decision 0014): half the meadow's area (9x8 = 72 tiles
// vs 144) for quick 2v2 playtest rounds. Not a game map; delete with the
// quick test scenario in main.ts.
export const glade: MapTemplate = {
  id: 'glade',
  name: 'Little Glade',
  rows: [
    '001112233',
    '000111223',
    '00~001112',
    '0~~000011',
    '000000001',
    '001100000',
    '012210000',
    '001100000',
  ],
  spawns: {
    player: [{ x: 1, y: 7 }, { x: 0, y: 6 }],
    enemy: [{ x: 7, y: 1 }, { x: 8, y: 2 }],
  },
};
