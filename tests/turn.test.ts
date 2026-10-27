import { describe, expect, it } from 'vitest';
import { gridFromRows } from '../src/rules/grid';
import { advance, CT_CARRY, endTurn, predictOrder, READY_CT } from '../src/rules/turn';
import type { GameState, Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

function idle(units: Unit[]): GameState {
  // An empty phase; advance() runs the clock from here.
  return { grid: gridFromRows(flat(6, 6)), units, turn: { phase: 'player', active: [] } };
}

describe('advance', () => {
  it('ticks ct by speed until a unit is ready', () => {
    // Archer spd 7 reaches 100 on tick 15 (105); squire spd 6 is at 90.
    const r = advance(idle([makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }), makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })]));
    expect(r.state.turn).toEqual({ phase: 'player', active: [{ unitId: 'a', moved: false, acted: false }] });
    expect(r.state.units.map((u) => u.ct)).toEqual([105, 90]);
    expect(r.events).toContainEqual({ type: 'phase', phase: 'player', unitIds: ['a'] });
  });

  it('runs the player phase before enemies ready on the same tick, then the enemies without ticking', () => {
    const units = [makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }), makeUnit('e', 'enemy', 'archer', { x: 5, y: 5 })];
    const first = advance(idle(units));
    expect(first.state.turn.phase).toBe('player');
    const second = endTurn(first.state, 'a');
    expect(second.state.turn).toMatchObject({ phase: 'enemy', active: [{ unitId: 'e' }] });
    expect(second.state.units.find((u) => u.id === 'e')!.ct).toBe(105);
  });

  it('puts every ready player unit in one phase, most CT first', () => {
    const units = [
      makeUnit('s', 'p1', 'squire', { x: 0, y: 0 }, { patch: { ct: 100 } }),
      makeUnit('a', 'p2', 'archer', { x: 1, y: 0 }, { patch: { ct: 110 } }),
      makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 }),
    ];
    const r = advance(idle(units));
    expect(r.state.turn).toMatchObject({ phase: 'player', active: [{ unitId: 'a' }, { unitId: 's' }] });
  });

  it('expires statuses at the start of their unit\'s turn', () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: 100, statuses: [{ id: 'guard', turns: 1 }, { id: 'pinned', turns: 2 }] } });
    const r = advance(idle([a, makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })]));
    expect(r.state.units[0]!.statuses).toEqual([{ id: 'pinned', turns: 1 }]);
    expect(r.events).toContainEqual({ type: 'status', unitId: 'a', status: 'guard', added: false });
  });

  it('counts down downed units on their would-be turns, then they die', () => {
    const down = makeUnit('d', 'p1', 'squire', { x: 0, y: 0 }, { patch: { hp: 0, downedTurns: 2, ct: 99 } });
    const units = [down, makeUnit('a', 'p1', 'archer', { x: 1, y: 0 }), makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })];
    let r = advance(idle(units));
    expect(r.events).toContainEqual({ type: 'down-tick', unitId: 'd', turnsLeft: 1 });
    // Its CT restarts from 0 and keeps ticking until someone is ready.
    expect(r.state.units[0]!.downedTurns).toBe(1);
    expect(r.state.units[0]!.ct).toBeLessThan(100);

    r = advance(idle([{ ...r.state.units[0]!, ct: 99 }, ...units.slice(1)]));
    expect(r.events).toContainEqual({ type: 'died', unitId: 'd' });
    expect(r.state.units[0]!.dead).toBe(true);
    expect(r.state.units[0]!.downedTurns).toBeUndefined();
  });

  it('ends the battle when a side has nobody standing', () => {
    const units = [
      makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }),
      makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 }, { patch: { hp: 0, downedTurns: 3 } }),
    ];
    const r = advance(idle(units));
    expect(r.state.turn).toEqual({ phase: 'over', winner: 'player' });
    expect(r.events).toContainEqual({ type: 'battle-over', winner: 'player' });
  });
});

describe('endTurn', () => {
  const phase = (moved: boolean, acted: boolean): GameState => ({
    grid: gridFromRows(flat(6, 6)),
    units: [
      makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: READY_CT } }),
      makeUnit('b', 'p1', 'archer', { x: 1, y: 0 }, { patch: { ct: READY_CT } }),
      makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 }),
    ],
    turn: { phase: 'player', active: [{ unitId: 'a', moved, acted }, { unitId: 'b', moved: false, acted: false }] },
  });

  it('keeps more CT the less the unit did', () => {
    expect(endTurn(phase(true, true), 'a').state.units[0]!.ct).toBe(CT_CARRY.both);
    expect(endTurn(phase(true, false), 'a').state.units[0]!.ct).toBe(CT_CARRY.one);
    expect(endTurn(phase(false, true), 'a').state.units[0]!.ct).toBe(CT_CARRY.one);
    expect(endTurn(phase(false, false), 'a').state.units[0]!.ct).toBe(CT_CARRY.none);
  });

  it('keeps the phase going while other units are still active', () => {
    const r = endTurn(phase(true, true), 'a');
    expect(r.state.turn).toMatchObject({ phase: 'player', active: [{ unitId: 'b' }] });
  });
});

describe('predictOrder', () => {
  it('lists the active units first, then simulates the clock', () => {
    const state: GameState = {
      grid: gridFromRows(flat(6, 6)),
      units: [
        makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: 105 } }),
        makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 }, { patch: { ct: 90 } }),
      ],
      turn: { phase: 'player', active: [{ unitId: 'a', moved: false, acted: false }] },
    };
    // e reaches 102 after 2 ticks; a (reset to 0) reaches 105 after 15.
    expect(predictOrder(state, 4)).toEqual(['a', 'e', 'a', 'e']);
  });

  it('skips downed and dead units', () => {
    const state: GameState = {
      grid: gridFromRows(flat(6, 6)),
      units: [
        makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }),
        makeUnit('d', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 0, downedTurns: 2 } }),
        makeUnit('g', 'enemy', 'squire', { x: 2, y: 0 }, { patch: { dead: true } }),
      ],
      turn: { phase: 'player', active: [] },
    };
    expect(predictOrder(state, 3)).toEqual(['a', 'a', 'a']);
  });
});
