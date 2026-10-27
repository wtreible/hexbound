import { describe, expect, it } from 'vitest';
import { facingOfStep, gridFromRows, indexOf, pathTo, reachable, tileAt } from '../src/rules/grid';
import type { Pos, Stat, Unit } from '../src/rules/types';

function unit(id: string, ownerId: string, pos: Pos, move = 3, jump = 1): Unit {
  const base = { hp: 10, mp: 0, atk: 1, mag: 1, def: 0, res: 0, spd: 5, move, jump, evade: 0 } satisfies Record<Stat, number>;
  return { id, ownerId, name: id, base, pos, facing: 2 };
}

const keys = (reach: ReturnType<typeof reachable>, stoppable = true) =>
  [...reach.values()]
    .filter((n) => !stoppable || n.canStop)
    .map((n) => `${n.pos.x},${n.pos.y}`)
    .sort();

describe('gridFromRows', () => {
  it('parses heights, water and dimensions', () => {
    const g = gridFromRows(['01', '~5']);
    expect(g.width).toBe(2);
    expect(g.depth).toBe(2);
    expect(tileAt(g, { x: 1, y: 0 })).toMatchObject({ height: 1, walkable: true });
    expect(tileAt(g, { x: 0, y: 1 })).toMatchObject({ terrain: 'water', walkable: false });
    expect(tileAt(g, { x: 1, y: 1 })).toMatchObject({ height: 5, terrain: 'stone' });
    expect(tileAt(g, { x: 2, y: 0 })).toBeUndefined();
  });

  it('rejects ragged rows and unknown characters', () => {
    expect(() => gridFromRows(['00', '0'])).toThrow();
    expect(() => gridFromRows(['0x'])).toThrow();
  });
});

describe('reachable', () => {
  it('limits distance by move on flat ground', () => {
    const g = gridFromRows(['00000', '00000', '00000']);
    const u = unit('a', 'p1', { x: 0, y: 0 }, 2);
    expect(keys(reachable(g, [u], u))).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '2,0']);
  });

  it('blocks steps whose height difference exceeds jump, up or down', () => {
    // A 2-tier wall between the columns; jump 1 cannot cross it either way.
    const g = gridFromRows(['020', '020', '000']);
    const low = unit('a', 'p1', { x: 0, y: 0 }, 2, 1);
    expect(keys(reachable(g, [low], low))).toEqual(['0,0', '0,1', '0,2']);
    const high = unit('b', 'p1', { x: 0, y: 0 }, 2, 2);
    expect(keys(reachable(g, [high], high))).toContain('1,0');
    const top = unit('c', 'p1', { x: 1, y: 0 }, 1, 1);
    expect(keys(reachable(g, [top], top))).toEqual(['1,0', '1,1']);
  });

  it('never enters water', () => {
    const g = gridFromRows(['0~0']);
    const u = unit('a', 'p1', { x: 0, y: 0 }, 5);
    expect(keys(reachable(g, [u], u))).toEqual(['0,0']);
  });

  it('passes through allies but cannot stop on them', () => {
    const g = gridFromRows(['000']);
    const u = unit('a', 'p1', { x: 0, y: 0 }, 2);
    const ally = unit('b', 'p1', { x: 1, y: 0 });
    const reach = reachable(g, [u, ally], u);
    expect(keys(reach)).toEqual(['0,0', '2,0']);
    expect(keys(reach, false)).toContain('1,0');
  });

  it('cannot pass through enemies', () => {
    const g = gridFromRows(['000']);
    const u = unit('a', 'p1', { x: 0, y: 0 }, 2);
    const foe = unit('b', 'p2', { x: 1, y: 0 });
    expect(keys(reachable(g, [u, foe], u))).toEqual(['0,0']);
  });
});

describe('pathTo', () => {
  it('returns a shortest orthogonal path including both ends', () => {
    const g = gridFromRows(['000', '0~0', '000']);
    const u = unit('a', 'p1', { x: 0, y: 0 }, 4);
    const path = pathTo(g, reachable(g, [u], u), { x: 2, y: 2 });
    expect(path).toHaveLength(5);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[4]).toEqual({ x: 2, y: 2 });
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1]!, path[i]!];
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
      expect(indexOf(g, b)).not.toBe(indexOf(g, { x: 1, y: 1 }));
    }
  });

  it('is empty for unreachable tiles', () => {
    const g = gridFromRows(['0~0']);
    const u = unit('a', 'p1', { x: 0, y: 0 });
    expect(pathTo(g, reachable(g, [u], u), { x: 2, y: 0 })).toEqual([]);
  });
});

describe('facingOfStep', () => {
  it('maps each orthogonal step to its facing', () => {
    const o = { x: 1, y: 1 };
    expect(facingOfStep(o, { x: 1, y: 0 })).toBe(0);
    expect(facingOfStep(o, { x: 2, y: 1 })).toBe(1);
    expect(facingOfStep(o, { x: 1, y: 2 })).toBe(2);
    expect(facingOfStep(o, { x: 0, y: 1 })).toBe(3);
  });
});
