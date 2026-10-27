import { describe, expect, it } from 'vitest';
import { gridFromRows } from '../src/rules/grid';
import { applyIntent } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import type { GameState, Pos, Stat, Unit } from '../src/rules/types';

function unit(id: string, ownerId: string, pos: Pos): Unit {
  const base = { hp: 10, mp: 0, atk: 1, mag: 1, def: 0, res: 0, spd: 5, move: 3, jump: 1, evade: 0 } satisfies Record<Stat, number>;
  return { id, ownerId, name: id, base, pos, facing: 2 };
}

function state(): GameState {
  return {
    grid: gridFromRows(['0000', '0000', '0000']),
    units: [unit('a', 'p1', { x: 0, y: 0 }), unit('b', 'p2', { x: 3, y: 2 })],
  };
}

const rng = createRng(1);

describe('applyIntent move', () => {
  it('moves the unit, faces it along the last step and emits the path', () => {
    const s = state();
    const r = applyIntent(s, { type: 'move', unitId: 'a', to: { x: 2, y: 0 } }, rng);
    if ('error' in r) throw new Error(r.error);
    const a = r.state.units.find((u) => u.id === 'a')!;
    expect(a.pos).toEqual({ x: 2, y: 0 });
    expect(a.facing).toBe(1);
    expect(r.events).toEqual([{ type: 'moved', unitId: 'a', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }]);
  });

  it('does not mutate the input state', () => {
    const s = state();
    const before = JSON.stringify(s);
    applyIntent(s, { type: 'move', unitId: 'a', to: { x: 1, y: 0 } }, rng);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects unreachable, occupied, out-of-bounds and no-op moves', () => {
    const s = state();
    const move = (to: Pos, unitId = 'a') => applyIntent(s, { type: 'move', unitId, to }, rng);
    expect(move({ x: 3, y: 1 })).toHaveProperty('error'); // 4 steps, move 3
    expect(move({ x: 3, y: 2 }, 'b')).toHaveProperty('error'); // own tile
    expect(move({ x: 9, y: 9 })).toHaveProperty('error');
    expect(move({ x: 0, y: 0 })).toHaveProperty('error');
    expect(move({ x: 0, y: 0 }, 'zz')).toHaveProperty('error');
  });
});

describe('applyIntent face', () => {
  it('sets facing', () => {
    const r = applyIntent(state(), { type: 'face', unitId: 'a', facing: 3 }, rng);
    if ('error' in r) throw new Error(r.error);
    expect(r.state.units[0]!.facing).toBe(3);
    expect(r.events).toEqual([{ type: 'faced', unitId: 'a', facing: 3 }]);
  });
});
