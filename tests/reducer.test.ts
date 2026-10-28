import { describe, expect, it } from 'vitest';
import { ACT_JP, applyIntent, type IntentResult } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import { CLEAR_BONUS_JP, CT_CARRY } from '../src/rules/turn';
import type { GameState, Intent } from '../src/rules/types';
import { battle, flat, makeUnit } from './fixtures';

const rng = createRng(1);

function ok(r: IntentResult) {
  if ('error' in r) throw new Error(r.error);
  return r;
}

// p1 squire 's' and archer 'a' are active; two enemy squires stand to the north.
function state(): GameState {
  return battle(
    flat(6, 6),
    [
      makeUnit('s', 'p1', 'squire', { x: 0, y: 5 }, { patch: { ct: 100 } }),
      makeUnit('a', 'p1', 'archer', { x: 1, y: 5 }, { patch: { ct: 100 } }),
      makeUnit('e1', 'enemy', 'archer', { x: 1, y: 1 }, { facing: 0 }),
      makeUnit('e2', 'enemy', 'squire', { x: 5, y: 0 }),
    ],
    ['s', 'a'],
  );
}

const apply = (s: GameState, intent: Intent) => applyIntent(s, intent, rng);

describe('move', () => {
  it('moves the unit, faces it along the last step and emits the path', () => {
    const r = ok(apply(state(), { type: 'move', unitId: 's', to: { x: 2, y: 5 } }));
    const s = r.state.units.find((u) => u.id === 's')!;
    expect(s.pos).toEqual({ x: 2, y: 5 });
    expect(s.facing).toBe(1);
    expect(r.events).toEqual([
      // Through the allied archer at (1, 5), which can be passed but not stopped on.
      { type: 'moved', unitId: 's', path: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }] },
    ]);
  });

  it('allows one move per turn and respects reach', () => {
    const s0 = state();
    expect(apply(s0, { type: 'move', unitId: 's', to: { x: 0, y: 0 } })).toHaveProperty('error'); // 5 steps, move 4
    const r = ok(apply(s0, { type: 'move', unitId: 's', to: { x: 0, y: 4 } }));
    expect(apply(r.state, { type: 'move', unitId: 's', to: { x: 0, y: 3 } })).toEqual({ error: 'already moved' });
  });

  it('does not mutate the input state', () => {
    const s = state();
    const before = JSON.stringify(s);
    apply(s, { type: 'move', unitId: 's', to: { x: 0, y: 4 } });
    apply(s, { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('act', () => {
  it('resolves the ability and marks the unit as having acted', () => {
    // e1 faces north, so the archer shoots it in the back: 100% hit, (14 - 4) * 1.25 = 12.5 -> 13.
    const r = ok(apply(state(), { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } }));
    expect(r.state.units.find((u) => u.id === 'e1')!.hp).toBe(32 - 13);
    expect(r.state.turn).toMatchObject({ active: [{ unitId: 's' }, { unitId: 'a', acted: true }] });
    expect(apply(r.state, { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } })).toEqual({ error: 'already acted' });
  });

  it('rejects out-of-range targets, unknown abilities and missing MP', () => {
    const s = state();
    expect(apply(s, { type: 'act', unitId: 's', abilityId: 'strike', target: { x: 1, y: 1 } })).toEqual({ error: 'target out of range' });
    expect(apply(s, { type: 'act', unitId: 's', abilityId: 'mend', target: { x: 0, y: 5 } })).toHaveProperty('error');
    const broke = { ...s, units: s.units.map((u) => (u.id === 'a' ? { ...u, mp: 0 } : u)) };
    expect(apply(broke, { type: 'act', unitId: 'a', abilityId: 'aim', target: { x: 1, y: 1 } })).toEqual({ error: 'not enough MP' });
  });

  it('ends the battle when the last enemy goes down', () => {
    const s = state();
    const last = {
      ...s,
      units: s.units.filter((u) => u.id !== 'e2').map((u) => (u.id === 'e1' ? { ...u, hp: 1 } : u)),
    };
    const r = ok(apply(last, { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } }));
    expect(r.state.turn).toEqual({ phase: 'over', winner: 'player' });
    expect(apply(r.state, { type: 'wait', unitId: 's' })).toEqual({ error: 'battle is over' });
  });
});

describe('turn ownership', () => {
  it('only lets active units act', () => {
    expect(apply(state(), { type: 'move', unitId: 'e1', to: { x: 0, y: 2 } })).toHaveProperty('error');
  });

  it('makes enemies act strictly in order', () => {
    const s = battle(flat(4, 4), [makeUnit('e1', 'enemy', 'squire', { x: 0, y: 0 }), makeUnit('e2', 'enemy', 'squire', { x: 3, y: 3 }), makeUnit('p', 'p1', 'squire', { x: 3, y: 0 })], ['e1', 'e2'], 'enemy');
    expect(apply(s, { type: 'wait', unitId: 'e2' })).toHaveProperty('error');
    expect('error' in apply(s, { type: 'wait', unitId: 'e1' })).toBe(false);
  });
});

describe('face and wait', () => {
  it('sets facing at any point in the turn', () => {
    const r = ok(apply(state(), { type: 'face', unitId: 's', facing: 3 }));
    expect(r.state.units[0]!.facing).toBe(3);
    expect(r.events).toEqual([{ type: 'faced', unitId: 's', facing: 3 }]);
  });

  it('ends the turn with the CT carry for what the unit did', () => {
    const moved = ok(apply(state(), { type: 'move', unitId: 's', to: { x: 0, y: 4 } }));
    const r = ok(apply(moved.state, { type: 'wait', unitId: 's' }));
    expect(r.state.units[0]!.ct).toBe(CT_CARRY.one);
    expect(r.state.turn).toMatchObject({ phase: 'player', active: [{ unitId: 'a' }] });
  });
});

describe('M4: JP, Resolve and traps', () => {
  it('awards ACT_JP to the current job for acting', () => {
    const r = ok(apply(state(), { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } }));
    const jp = r.events.find((e) => e.type === 'jp');
    expect(jp).toMatchObject({ unitId: 'a', job: 'archer' });
    const amount = (jp as { amount: number }).amount;
    expect(amount).toBeGreaterThanOrEqual(ACT_JP.min);
    expect(amount).toBeLessThanOrEqual(ACT_JP.max);
    expect(r.state.units.find((u) => u.id === 'a')!.jp.archer).toBe(amount);
  });

  it('pays the clear bonus to surviving player units on victory', () => {
    const s = state();
    const last = { ...s, units: s.units.filter((u) => u.id !== 'e2').map((u) => (u.id === 'e1' ? { ...u, hp: 1 } : u)) };
    const r = ok(apply(last, { type: 'act', unitId: 'a', abilityId: 'shoot', target: { x: 1, y: 1 } }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'jp', unitId: 's', amount: CLEAR_BONUS_JP }));
    expect(r.state.units.find((u) => u.id === 's')!.jp.squire).toBe(CLEAR_BONUS_JP);
  });

  it('rejects ultimates without full Resolve and locked abilities', () => {
    const s = state();
    const withUlt = { ...s, units: s.units.map((u) => (u.id === 's' ? { ...u, ultimate: 'last-stand', jp: { squire: 300 } } : u)) };
    expect(apply(withUlt, { type: 'act', unitId: 's', abilityId: 'last-stand', target: { x: 0, y: 5 } })).toEqual({ error: 'not enough Resolve' });
    const full = { ...withUlt, units: withUlt.units.map((u) => (u.id === 's' ? { ...u, resolve: 100 } : u)) };
    expect('error' in apply(full, { type: 'act', unitId: 's', abilityId: 'last-stand', target: { x: 0, y: 5 } })).toBe(false);
    expect(apply(s, { type: 'act', unitId: 's', abilityId: 'shove', target: { x: 0, y: 4 } })).toHaveProperty('error'); // Rank 2
  });

  it("stops a unit on a hostile trap, which goes off; allies walk over their own", () => {
    const trap = { id: 'trap' as const, pos: { x: 1, y: 2 }, rounds: 6, ownerId: 'p1' };
    const foe = battle(flat(4, 4), [makeUnit('e', 'enemy', 'squire', { x: 0, y: 2 }), makeUnit('p', 'p1', 'squire', { x: 3, y: 0 })], ['e'], 'enemy', [trap]);
    const r = ok(apply(foe, { type: 'move', unitId: 'e', to: { x: 3, y: 2 } }));
    const e = r.state.units.find((u) => u.id === 'e')!;
    expect(e.pos).toEqual({ x: 1, y: 2 });
    expect(e.hp).toBe(43 - 12);
    expect(e.statuses).toEqual([{ id: 'pinned', turns: 2 }]);
    expect(r.state.hazards).toEqual([]);
    expect(r.events).toContainEqual({ type: 'triggered', unitId: 'e', hazard: 'trap', pos: { x: 1, y: 2 } });

    const own = battle(flat(4, 4), [makeUnit('p', 'p1', 'squire', { x: 0, y: 2 }), makeUnit('e', 'enemy', 'squire', { x: 3, y: 0 })], ['p'], 'player', [trap]);
    const walked = ok(apply(own, { type: 'move', unitId: 'p', to: { x: 3, y: 2 } }));
    expect(walked.state.units[0]!.pos).toEqual({ x: 3, y: 2 });
    expect(walked.state.hazards).toHaveLength(1);
  });
});
