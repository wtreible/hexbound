import type { Pos } from '../../rules/types';

// Map template format: one string per row, '0'-'9' = height in tiers, '~' = water.
// Spawns are keyed by owner slot.
export type MapTemplate = {
  id: string;
  name: string;
  rows: string[];
  spawns: Record<string, Pos[]>;
};

export const meadow: MapTemplate = {
  id: 'meadow',
  name: 'Hollow Meadow',
  rows: [
    '000011122233',
    '000011122334',
    '000001112344',
    '00~~00011234',
    '0~~~~0001123',
    '00~~00000112',
    '000000000011',
    '001100000000',
    '012210000000',
    '012321000110',
    '001210001221',
    '000100001221',
  ],
  spawns: {
    p1: [{ x: 1, y: 10 }, { x: 2, y: 11 }],
    p2: [{ x: 9, y: 1 }, { x: 10, y: 2 }],
  },
};
