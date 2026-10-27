import { describe, expect, it } from 'vitest';
import { gridFromRows } from '../src/rules/grid';
import { advance, CT_CARRY, endTurn, predictOrder, READY_CT } from '../src/rules/turn';
import type { GameState, Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

function idle(units: Unit[]): GameState {
  // An empty phase; advance() runs the clock from here.
  // An empty waiting list means the next advance() starts a new round.
  return { grid: gridFromRows(flat(6, 6)), units, hazards: [], round: { n: 0, waiting: [] }, inventory: {}, loot: [], objective: { type: 'rout' }, casts: [], turn: { phase: 'player', active: [] } };
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

  it('gives downed units 3 full rounds, then they die as the 4th starts', () => {
    // Each advance() here starts a player phase, i.e. a new round.
    const down = makeUnit('d', 'p1', 'squire', { x: 0, y: 0 }, { patch: { hp: 0, downedRounds: 3 } });
    let units = [down, makeUnit('a', 'p1', 'archer', { x: 1, y: 0 }), makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })];
    for (const left of [2, 1, 0]) {
      const r = advance(idle(units));
      expect(r.events).toContainEqual({ type: 'down-tick', unitId: 'd', roundsLeft: left });
      expect(r.state.units[0]!.downedRounds).toBe(left);
      // Reset the clock so the (faster) archer starts the next phase: a player phase.
      units = r.state.units.map((u) => ({ ...u, ct: 0 }));
    }
    const r = advance(idle(units));
    expect(r.events).toContainEqual({ type: 'died', unitId: 'd' });
    expect(r.state.units[0]!.dead).toBe(true);
    expect(r.state.units[0]!.downedRounds).toBeUndefined();
  });

  it('keeps a round going until every standing unit has had a turn', () => {
    const down = makeUnit('d', 'p1', 'squire', { x: 0, y: 0 }, { patch: { hp: 0, downedRounds: 1 } });
    const units = [down, makeUnit('a', 'p1', 'archer', { x: 1, y: 0 }), makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })];
    // 'e' hasn't acted this round yet, so no new round and no countdown.
    const mid = advance({ ...idle(units), round: { n: 4, waiting: ['e'] } });
    expect(mid.state.round.n).toBe(4);
    expect(mid.state.units[0]!.downedRounds).toBe(1);
    // Once e's turn ends, the next advance starts round 5.
    const after = endTurn({ ...mid.state, turn: { phase: 'enemy', active: [{ unitId: 'e', moved: false, acted: false }] } }, 'e');
    expect(after.events).toContainEqual({ type: 'round', n: 5 });
    expect(after.state.units[0]!.downedRounds).toBe(0);
  });

  it('ends the battle when a side has nobody standing', () => {
    const units = [
      makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }),
      makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 }, { patch: { hp: 0, downedRounds: 3 } }),
    ];
    const r = advance(idle(units));
    expect(r.state.turn).toEqual({ phase: 'over', winner: 'player' });
    expect(r.events).toContainEqual({ type: 'battle-over', winner: 'player' });
  });
});

describe('endTurn', () => {
  const phase = (moved: boolean, acted: boolean): GameState => ({
    grid: gridFromRows(flat(6, 6)),
    hazards: [],
    round: { n: 1, waiting: [] },
    inventory: {},
    loot: [],
    objective: { type: 'rout' },
    casts: [],
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
      hazards: [],
      round: { n: 1, waiting: [] },
      inventory: {},
      loot: [],
      objective: { type: 'rout' },
      casts: [],
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
      hazards: [],
      round: { n: 1, waiting: [] },
      inventory: {},
      loot: [],
      objective: { type: 'rout' },
      casts: [],
      units: [
        makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }),
        makeUnit('d', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 0, downedRounds: 2 } }),
        makeUnit('g', 'enemy', 'squire', { x: 2, y: 0 }, { patch: { dead: true } }),
      ],
      turn: { phase: 'player', active: [] },
    };
    expect(predictOrder(state, 3)).toEqual(['a', 'a', 'a']);
  });
});

describe('turn start and rounds (M4)', () => {
  const enemy = () => makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 });

  it('poisons and burns at the start of the turn', () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: 100, statuses: [{ id: 'poison', turns: 3 }] } });
    const fire = { id: 'fire' as const, pos: { x: 0, y: 0 }, rounds: 3, ownerId: 'p2' };
    const r = advance({ ...idle([a, enemy()]), hazards: [fire] });
    // 32 HP archer: poison 10% = 3, fire 15% = 5
    expect(r.state.units[0]!.hp).toBe(32 - 3 - 5);
    expect(r.events).toContainEqual({ type: 'damaged', unitId: 'a', amount: 3, source: 'poison' });
    expect(r.events).toContainEqual({ type: 'damaged', unitId: 'a', amount: 5, source: 'fire' });
  });

  it('restores MP with Mana Well', () => {
    const m = makeUnit('m', 'p1', 'mage', { x: 0, y: 0 }, { patch: { ct: 100, mp: 0, passive: 'mana-well' } });
    expect(advance(idle([m, enemy()])).state.units[0]!.mp).toBe(3);
  });

  it('ages hazards at the start of each round', () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: 100 } });
    const hazards = [
      { id: 'oil' as const, pos: { x: 2, y: 2 }, rounds: 1, ownerId: 'p1' },
      { id: 'trap' as const, pos: { x: 3, y: 3 }, rounds: 4, ownerId: 'p1' },
    ];
    const r = advance({ ...idle([a, enemy()]), hazards });
    expect(r.state.hazards).toEqual([{ ...hazards[1], rounds: 3 }]);
    expect(r.events).toContainEqual({ type: 'hazard', hazard: 'oil', pos: { x: 2, y: 2 }, added: false });
  });
});
