import type { MapTemplate } from './meadow';

// A ruined keep: tall broken walls ring a courtyard with a central dais.
// Gaps in the north wall, both side walls and a southern gate let units in.
export const keep: MapTemplate = {
  id: 'keep',
  name: 'Ruined Keep',
  rows: [
    '0000000000000',
    '0066606660600',
    '0061111111600',
    '0011111111100',
    '0061122211600',
    '0061123211600',
    '0061122211600',
    '0011111111100',
    '0061111111600',
    '0066611166600',
    '0000000000000',
    '0001000001000',
    '0000000000000',
  ],
  spawns: {
    player: [{ x: 5, y: 11 }, { x: 6, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 12 }],
    enemy: [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }],
  },
  exits: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  hold: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
  vip: { x: 4, y: 12 },
};
