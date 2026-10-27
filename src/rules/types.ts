// Core game types (DESIGN.md §8). Everything here is a plain serializable
// object so it can be diffed, sent over the network and saved.
//
// M1 holds only what the board needs; CT, HP, jobs and the rest arrive in M2.

export type Pos = { x: number; y: number };

/** 0 = north (-y), 1 = east (+x), 2 = south (+y), 3 = west (-x). */
export type Facing = 0 | 1 | 2 | 3;

export type Stat = 'hp' | 'mp' | 'atk' | 'mag' | 'def' | 'res' | 'spd' | 'move' | 'jump' | 'evade';

export type TerrainId = 'grass' | 'dirt' | 'stone' | 'water';

export type Tile = {
  /** Height in tiers; one tier is half a tile tall. */
  height: number;
  terrain: TerrainId;
  walkable: boolean;
};

/** Row-major: tile (x, y) is tiles[y * width + x]. */
export type Grid = { width: number; depth: number; tiles: Tile[] };

export type Unit = {
  id: string;
  ownerId: string;
  name: string;
  base: Record<Stat, number>;
  pos: Pos;
  facing: Facing;
};

export type GameState = { grid: Grid; units: Unit[] };

export type Intent =
  | { type: 'move'; unitId: string; to: Pos }
  | { type: 'face'; unitId: string; facing: Facing };

export type GameEvent =
  | { type: 'moved'; unitId: string; path: Pos[] }
  | { type: 'faced'; unitId: string; facing: Facing };
