import type { Facing, Grid, Pos, TerrainId, Tile, Unit } from './types';
import { sameSide } from './units';

// Map templates are rows of characters: '0'-'9' is a walkable tile at that
// height (in tiers), '~' is water (height 0, not walkable). Terrain for land
// tiles is derived from height until maps carry it explicitly.
export function gridFromRows(rows: string[]): Grid {
  const depth = rows.length;
  const width = rows[0]?.length ?? 0;
  const tiles: Tile[] = [];
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) throw new Error(`map row ${y} has length ${row.length}, expected ${width}`);
    for (const ch of row) {
      if (ch === '~') {
        tiles.push({ height: 0, terrain: 'water', walkable: false });
        continue;
      }
      const height = Number(ch);
      if (!Number.isInteger(height)) throw new Error(`bad map character '${ch}' in row ${y}`);
      tiles.push({ height, terrain: terrainForHeight(height), walkable: true });
    }
  }
  return { width, depth, tiles };
}

function terrainForHeight(h: number): TerrainId {
  if (h <= 1) return 'grass';
  if (h <= 3) return 'dirt';
  return 'stone';
}

export function inBounds(grid: Grid, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.depth;
}

export function indexOf(grid: Grid, p: Pos): number {
  return p.y * grid.width + p.x;
}

export function posOf(grid: Grid, index: number): Pos {
  return { x: index % grid.width, y: Math.floor(index / grid.width) };
}

export function tileAt(grid: Grid, p: Pos): Tile | undefined {
  return inBounds(grid, p) ? grid.tiles[indexOf(grid, p)] : undefined;
}

/** Unit step for each facing, indexed by Facing. */
export const FACING_STEPS: readonly Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function neighbors(grid: Grid, p: Pos): Pos[] {
  return FACING_STEPS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter((n) => inBounds(grid, n));
}

/** First orthogonal step from a toward b along the dominant axis (x wins ties). */
export function stepToward(a: Pos, b: Pos): Pos {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: a.x + Math.sign(dx), y: a.y } : { x: a.x, y: a.y + Math.sign(dy) };
}

/** Facing of a single orthogonal step from a to b. */
export function facingOfStep(a: Pos, b: Pos): Facing {
  if (b.x > a.x) return 1;
  if (b.x < a.x) return 3;
  return b.y > a.y ? 2 : 0;
}

export type ReachNode = {
  pos: Pos;
  cost: number;
  /** Grid index of the previous tile on the shortest path, or -1 at the start. */
  prev: number;
  /** False for tiles the unit may pass through but not end on (allies). */
  canStop: boolean;
};

/** Grid index -> node, for every tile the unit can path through this turn. */
export type Reach = Map<number, ReachNode>;

export type MoveLimits = { move: number; jump: number };

/** A step between walkable tiles is legal when the height change, up or down, is within jump. */
export function canStep(grid: Grid, from: Pos, to: Pos, jump: number): boolean {
  const a = tileAt(grid, from);
  const b = tileAt(grid, to);
  return !!a && !!b && a.walkable && b.walkable && Math.abs(b.height - a.height) <= jump;
}

// BFS over orthogonal steps. A step is legal when the target tile is walkable,
// the height difference is within jump (up or down), and the tile isn't held
// by a unit of the other side. Allies (including downed ones) can be passed
// through but not stood on. Graves don't block.
export function reachable(grid: Grid, units: readonly Unit[], unit: Unit, limits: MoveLimits): Reach {
  const occupant = new Map<number, Unit>();
  for (const u of units) if (u.id !== unit.id && !u.dead) occupant.set(indexOf(grid, u.pos), u);

  const start = indexOf(grid, unit.pos);
  const reach: Reach = new Map([[start, { pos: unit.pos, cost: 0, prev: -1, canStop: true }]]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi]!;
    const node = reach.get(i)!;
    if (node.cost >= limits.move) continue;
    for (const n of neighbors(grid, node.pos)) {
      const ni = indexOf(grid, n);
      if (reach.has(ni) || !canStep(grid, node.pos, n, limits.jump)) continue;
      const other = occupant.get(ni);
      if (other && !sameSide(other, unit)) continue;
      reach.set(ni, { pos: n, cost: node.cost + 1, prev: i, canStop: !other });
      queue.push(ni);
    }
  }
  return reach;
}

/** Path from the unit's tile to `to`, inclusive of both ends. Empty if unreachable. */
export function pathTo(grid: Grid, reach: Reach, to: Pos): Pos[] {
  const path: Pos[] = [];
  for (let i = indexOf(grid, to); i !== -1; ) {
    const node = reach.get(i);
    if (!node) return [];
    path.push(node.pos);
    i = node.prev;
  }
  return path.reverse();
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Steps from every tile to the nearest source, walking with the given jump
 * and ignoring units. Unreachable tiles are Infinity. Used by the AI to close
 * distance when nothing is in range.
 */
export function distanceMap(grid: Grid, sources: readonly Pos[], jump: number): number[] {
  const dist = grid.tiles.map(() => Infinity);
  const queue: Pos[] = [];
  for (const p of sources) {
    dist[indexOf(grid, p)] = 0;
    queue.push(p);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]!;
    const d = dist[indexOf(grid, p)]!;
    for (const n of neighbors(grid, p)) {
      const ni = indexOf(grid, n);
      // Walking from n towards p must be legal, so check the step n -> p.
      if (dist[ni] !== Infinity || !canStep(grid, n, p, jump)) continue;
      dist[ni] = d + 1;
      queue.push(n);
    }
  }
  return dist;
}
