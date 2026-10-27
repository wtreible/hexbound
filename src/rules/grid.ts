import type { Facing, Grid, Pos, TerrainId, Tile, Unit } from './types';

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

// BFS over orthogonal steps. A step is legal when the target tile is walkable,
// the height difference is within the unit's jump (up or down), and the tile
// isn't held by another owner's unit. Allies can be passed through but not
// stood on.
export function reachable(grid: Grid, units: readonly Unit[], unit: Unit): Reach {
  const occupant = new Map<number, Unit>();
  for (const u of units) if (u.id !== unit.id) occupant.set(indexOf(grid, u.pos), u);

  const start = indexOf(grid, unit.pos);
  const reach: Reach = new Map([[start, { pos: unit.pos, cost: 0, prev: -1, canStop: true }]]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi]!;
    const node = reach.get(i)!;
    if (node.cost >= unit.base.move) continue;
    const from = grid.tiles[i]!;
    for (const n of neighbors(grid, node.pos)) {
      const ni = indexOf(grid, n);
      if (reach.has(ni)) continue;
      const tile = grid.tiles[ni]!;
      if (!tile.walkable || Math.abs(tile.height - from.height) > unit.base.jump) continue;
      const other = occupant.get(ni);
      if (other && other.ownerId !== unit.ownerId) continue;
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
