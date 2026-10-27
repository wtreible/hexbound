import { describe, expect, it } from 'vitest';
import { BASE_STATS } from '../src/data/units';
import { planTurn } from '../src/rules/ai';
import { setupBattle, survivors } from '../src/rules/battle';
import { winner } from '../src/rules/objectives';
import { applyIntent, type IntentResult } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import { advance } from '../src/rules/turn';
import type { GameState, Objective, Unit } from '../src/rules/types';
import { battle, flat, makeUnit } from './fixtures';

const rng = createRng(1);
const ok = (r: IntentResult) => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const withObjective = (s: GameState, objective: Objective): GameState => ({ ...s, objective });

describe('leader', () => {
  it('is won by downing the leader even with others standing', () => {
    const units = [makeUnit('p', 'p1', 'squire', { x: 0, y: 0 }), makeUnit('e0', 'enemy', 'squire', { x: 3, y: 3 }), makeUnit('e1', 'enemy', 'archer', { x: 4, y: 4 })];
    const s = withObjective(battle(flat(6, 6), units, ['p']), { type: 'leader', unitId: 'e0' });
    expect(winner(s)).toBeNull();
    const down = { ...s, units: s.units.map((u) => (u.id === 'e0' ? { ...u, hp: 0, downedRounds: 3 } : u)) };
    expect(winner(down)).toBe('player');
  });
});

describe('escort', () => {
  const exits = [{ x: 3, y: 0 }];
  const units = () => [
    makeUnit('p', 'p1', 'squire', { x: 0, y: 0 }),
    makeUnit('vip', 'npc', 'chemist', { x: 2, y: 0 }),
    makeUnit('e', 'enemy', 'squire', { x: 0, y: 3 }),
  ];

  it('is won when the escorted unit reaches an exit', () => {
    const s = withObjective(battle(flat(4, 4), units(), ['vip']), { type: 'escort', unitId: 'vip', exits });
    const r = ok(applyIntent(s, { type: 'move', unitId: 'vip', to: { x: 3, y: 0 } }, rng));
    expect(r.state.turn).toEqual({ phase: 'over', winner: 'player' });
  });

  it('is lost if the escorted unit goes down', () => {
    const s = withObjective(battle(flat(4, 4), units(), ['p']), { type: 'escort', unitId: 'vip', exits });
    const down = { ...s, units: s.units.map((u) => (u.id === 'vip' ? { ...u, hp: 0, downedRounds: 3 } : u)) };
    expect(winner(down)).toBe('enemy');
  });

  it('brings a Pilgrim along at the map spot, who heads for the exit', () => {
    const { state } = setupBattle({
      rows: flat(8, 8),
      spawns: { player: [{ x: 0, y: 7 }], enemy: [{ x: 7, y: 7 }] },
      squad: [makeUnit('p0', 'p1', 'squire', { x: 0, y: 0 })],
      enemies: [{ name: 'Bandit', job: 'squire' }],
      base: BASE_STATS,
      objective: 'escort',
      exits: [{ x: 0, y: 0 }],
      vip: { x: 1, y: 7 },
    });
    const vip = state.units.find((u) => u.id === 'vip')!;
    expect(vip).toMatchObject({ ownerId: 'npc', name: 'Pilgrim', pos: { x: 1, y: 7 } });
    const s = { ...state, turn: { phase: 'player' as const, active: [{ unitId: 'vip', moved: false, acted: false }] } };
    const move = planTurn(s, 'vip', 'escort', [{ x: 0, y: 0 }]).find((i) => i.type === 'move');
    expect(move && move.type === 'move' && move.to.y).toBeLessThan(7);
  });
});

describe('hold', () => {
  const tiles = [{ x: 2, y: 2 }];
  const hold = (held: number): Objective => ({ type: 'hold', tiles, rounds: 2, held });

  it('counts a round when only player units stand on the ground, and wins at the target', () => {
    const units = [makeUnit('p', 'p1', 'squire', { x: 2, y: 2 }), makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })];
    const s = { ...withObjective(battle(flat(6, 6), units, []), hold(0)), round: { n: 1, waiting: [] } };
    const r = advance(s, rng);
    expect(r.events).toContainEqual({ type: 'held', held: 1, rounds: 2 });
    expect(winner(withObjective(r.state, hold(2)))).toBe('player');
  });

  it("doesn't count while an enemy stands on it too", () => {
    const tiles2 = [{ x: 2, y: 2 }, { x: 2, y: 3 }];
    const units = [makeUnit('p', 'p1', 'squire', { x: 2, y: 2 }), makeUnit('e', 'enemy', 'squire', { x: 2, y: 3 })];
    const s = { ...withObjective(battle(flat(6, 6), units, []), { type: 'hold', tiles: tiles2, rounds: 2, held: 0 }), round: { n: 1, waiting: [] } };
    expect(advance(s, rng).events.some((e) => e.type === 'held')).toBe(false);
  });
});

describe('escape', () => {
  const exits = [{ x: 3, y: 0 }];
  it('takes units that reach an exit off the board, and wins once everyone standing is out', () => {
    const units = [
      makeUnit('a', 'p1', 'archer', { x: 2, y: 0 }),
      makeUnit('d', 'p1', 'squire', { x: 0, y: 3 }, { patch: { hp: 0, downedRounds: 3 } }),
      makeUnit('e', 'enemy', 'squire', { x: 0, y: 0 }),
    ];
    const s = withObjective(battle(flat(4, 4), units, ['a']), { type: 'escape', exits });
    const r = ok(applyIntent(s, { type: 'move', unitId: 'a', to: { x: 3, y: 0 } }, rng));
    expect(r.events).toContainEqual({ type: 'escaped', unitId: 'a' });
    expect(r.state.turn).toEqual({ phase: 'over', winner: 'player' });
    // Downed units left behind are carried out; escapees come home.
    expect(survivors(r.state.units).map((u: Unit) => u.id).sort()).toEqual(['a', 'd']);
  });
});

describe('charge-time casts', () => {
  // A mage with Meteor (charge 8) equipped and a full Resolve meter.
  const mage = () => makeUnit('m', 'p1', 'mage', { x: 0, y: 0 }, { patch: { ultimate: 'meteor', jp: { mage: 300 }, resolve: 100 } });

  it('pays now and resolves on the tiles once the ticks run out, missing units that walked away', () => {
    const units = [mage(), makeUnit('stay', 'enemy', 'squire', { x: 3, y: 0 }), makeUnit('leave', 'enemy', 'squire', { x: 3, y: 1 }), makeUnit('x', 'enemy', 'squire', { x: 7, y: 7 })];
    const s = battle(flat(8, 8), units, ['m']);
    // Moving as well as acting leaves the mage 0 CT, so the 8-tick cast lands before its next turn.
    const stepped = ok(applyIntent(s, { type: 'move', unitId: 'm', to: { x: 0, y: 1 } }, rng));
    const cast = ok(applyIntent(stepped.state, { type: 'act', unitId: 'm', abilityId: 'meteor', target: { x: 3, y: 0 } }, rng));
    expect(cast.events).toContainEqual(expect.objectContaining({ type: 'cast', unitId: 'm', abilityId: 'meteor', ticks: 8 }));
    expect(cast.state.casts).toHaveLength(1);
    expect(cast.state.units[0]!.resolve).toBe(0);
    expect(cast.state.units.find((u) => u.id === 'stay')!.hp).toBe(43);

    // 'leave' walks out of the area before it lands.
    const moved = { ...cast.state, units: cast.state.units.map((u) => (u.id === 'leave' ? { ...u, pos: { x: 6, y: 6 } } : u)) };
    const ended = ok(applyIntent(moved, { type: 'wait', unitId: 'm' }, rng));
    expect(ended.events).toContainEqual({ type: 'cast-resolved', unitId: 'm', abilityId: 'meteor' });
    expect(ended.state.casts).toEqual([]);
    expect(ended.state.units.find((u) => u.id === 'stay')!.hp).toBeLessThan(43);
    expect(ended.state.units.find((u) => u.id === 'leave')!.hp).toBe(43);
  });

  it('fizzles if the caster is down when it would land', () => {
    const units = [mage(), makeUnit('e', 'enemy', 'squire', { x: 3, y: 0 }), makeUnit('p2', 'p1', 'squire', { x: 7, y: 7 })];
    const s = battle(flat(8, 8), units, ['m']);
    const cast = ok(applyIntent(s, { type: 'act', unitId: 'm', abilityId: 'meteor', target: { x: 3, y: 0 } }, rng));
    const downed = { ...cast.state, units: cast.state.units.map((u) => (u.id === 'm' ? { ...u, hp: 0, downedRounds: 3 } : u)) };
    const r = advance({ ...downed, turn: { phase: 'player', active: [] } }, rng);
    expect(r.events).toContainEqual({ type: 'cast-fizzled', unitId: 'm', abilityId: 'meteor' });
    expect(r.state.units.find((u) => u.id === 'e')!.hp).toBe(43);
  });
});

describe('silence and regen', () => {
  it('stops silenced units using magic', () => {
    const m = makeUnit('m', 'p1', 'mage', { x: 0, y: 0 }, { patch: { statuses: [{ id: 'silence', turns: 2 }] } });
    const s = battle(flat(5, 5), [m, makeUnit('e', 'enemy', 'squire', { x: 2, y: 0 })], ['m']);
    expect(applyIntent(s, { type: 'act', unitId: 'm', abilityId: 'flame', target: { x: 2, y: 0 } }, rng)).toEqual({ error: 'm is silenced' });
    expect('error' in applyIntent(s, { type: 'act', unitId: 'm', abilityId: 'staff', target: { x: 1, y: 0 } }, rng)).toBe(false);
  });

  it('heals Regen units by 10% of max HP at the start of their turn', () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { ct: 100, hp: 10, statuses: [{ id: 'regen', turns: 3 }] } });
    const s = { ...battle(flat(5, 5), [a, makeUnit('e', 'enemy', 'squire', { x: 4, y: 4 })], []), turn: { phase: 'player' as const, active: [] } };
    const r = advance(s, rng);
    expect(r.state.units[0]!.hp).toBe(13);
  });
});
