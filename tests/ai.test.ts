import { describe, expect, it } from 'vitest';
import { banditGroup } from '../src/data/enemies';
import { meadow } from '../src/data/maps/meadow';
import { BASE_STATS, testSquad } from '../src/data/units';
import { planTurn } from '../src/rules/ai';
import { newSquad, setupBattle } from '../src/rules/battle';
import { applyIntent } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import { availableJobs, grantJp, setLoadout } from '../src/rules/jobs';
import type { GameState, Unit } from '../src/rules/types';
import { battle, flat, makeUnit } from './fixtures';

function runPlan(state: GameState, unitId: string) {
  let s = state;
  const rng = createRng(3);
  for (const intent of planTurn(s, unitId)) {
    const r = applyIntent(s, intent, rng);
    if ('error' in r) throw new Error(`${intent.type}: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe('planTurn (berserker)', () => {
  it('walks up and attacks a player in reach, then ends its turn', () => {
    const s = battle(
      flat(6, 6),
      [makeUnit('e', 'enemy', 'squire', { x: 0, y: 0 }), makeUnit('p', 'p1', 'archer', { x: 3, y: 0 })],
      ['e'],
      'enemy',
    );
    const intents = planTurn(s, 'e');
    expect(intents.map((i) => i.type)).toEqual(['move', 'act', 'face', 'wait']);
    const act = intents.find((i) => i.type === 'act')!;
    expect(act).toMatchObject({ target: { x: 3, y: 0 } });
  });

  it('prefers a target it can take down', () => {
    const s = battle(
      flat(7, 7),
      [
        makeUnit('e', 'enemy', 'squire', { x: 3, y: 3 }),
        makeUnit('healthy', 'p1', 'squire', { x: 3, y: 1 }),
        makeUnit('weak', 'p1', 'archer', { x: 3, y: 5 }, { patch: { hp: 4 } }),
      ],
      ['e'],
      'enemy',
    );
    const act = planTurn(s, 'e').find((i) => i.type === 'act');
    expect(act).toMatchObject({ target: { x: 3, y: 5 } });
  });

  it('closes distance when nothing is in reach', () => {
    const s = battle(
      flat(12, 1),
      [makeUnit('e', 'enemy', 'squire', { x: 0, y: 0 }), makeUnit('p', 'p1', 'squire', { x: 11, y: 0 })],
      ['e'],
      'enemy',
    );
    const intents = planTurn(s, 'e');
    expect(intents.map((i) => i.type)).toEqual(['move', 'face', 'wait']);
    expect(intents[0]).toMatchObject({ to: { x: 4, y: 0 } });
  });

  it('does not volley into its own allies when a clean shot exists', () => {
    const s = battle(
      flat(9, 9),
      [
        makeUnit('e', 'enemy', 'archer', { x: 4, y: 8 }),
        makeUnit('buddy', 'enemy', 'squire', { x: 4, y: 3 }),
        makeUnit('p', 'p1', 'squire', { x: 4, y: 2 }),
      ],
      ['e'],
      'enemy',
    );
    const after = runPlan(s, 'e');
    expect(after.units.find((u) => u.id === 'buddy')!.hp).toBe(43);
  });

  it('produces intents the reducer accepts', () => {
    const { state } = setupBattle({ rows: meadow.rows, spawns: meadow.spawns, squad: newSquad(testSquad.map((m) => ({ ...m, ownerId: 'p1' })), BASE_STATS), enemies: banditGroup, base: BASE_STATS });
    expect(() => runPlan(state, state.turn.phase === 'over' ? '' : state.turn.active[0]!.unitId)).not.toThrow();
  });
});

describe('full battle', () => {
  // Both sides driven by the berserker AI: the meadow battle must reach a
  // result from start to finish without stalling or a rejected intent.
  it.each([1, 2, 3, 4, 5])('finishes with a winner (seed %i)', (seed) => {
    let { state } = setupBattle({ rows: meadow.rows, spawns: meadow.spawns, squad: newSquad(testSquad.map((m) => ({ ...m, ownerId: 'p1' })), BASE_STATS), enemies: banditGroup, base: BASE_STATS });
    const rng = createRng(seed);
    let turns = 0;
    while (state.turn.phase !== 'over') {
      if (++turns > 500) throw new Error('battle did not finish in 500 turns');
      const unitId = state.turn.active[0]!.unitId;
      for (const intent of planTurn(state, unitId)) {
        const r = applyIntent(state, intent, rng);
        if ('error' in r) throw new Error(`${unitId} ${intent.type}: ${r.error}`);
        state = r.state;
        if (state.turn.phase === 'over') break;
      }
    }
    expect(['player', 'enemy']).toContain(state.turn.winner);
  });
});

describe('M4 progression loop', () => {
  // Plays a full AI-vs-AI meadow battle and returns the final state.
  function play(squad: Unit[], seed: number) {
    let { state } = setupBattle({ rows: meadow.rows, spawns: meadow.spawns, squad, enemies: banditGroup, base: BASE_STATS });
    const rng = createRng(seed);
    for (let turns = 0; state.turn.phase !== 'over'; turns++) {
      if (turns > 500) throw new Error('battle did not finish');
      const unitId = state.turn.active[0]!.unitId;
      for (const intent of planTurn(state, unitId)) {
        const r = applyIntent(state, intent, rng);
        if ('error' in r) throw new Error(`${unitId} ${intent.type}: ${r.error}`);
        state = r.state;
        if (state.turn.phase === 'over') break;
      }
    }
    return state;
  }

  it('earns JP in battle, masters two jobs and switches to their hybrid', () => {
    const squad = newSquad(testSquad.map((m, i) => ({ ...m, ownerId: i % 2 === 0 ? 'p1' : 'p2' })), BASE_STATS);
    const after = play(squad, 7);
    const earned = after.units.filter((u) => u.ownerId !== 'enemy').reduce((n, u) => n + (u.jp[u.job] ?? 0), 0);
    expect(earned).toBeGreaterThan(0);

    // Debug JP stands in for several more battles, as in the M4 acceptance test.
    let ada = squad[0]!;
    ada = grantJp(ada, 300).unit;
    const asAcolyte = setLoadout(ada, { job: 'acolyte' });
    if ('error' in asAcolyte) throw new Error(asAcolyte.error);
    ada = grantJp(asAcolyte, 300).unit;
    expect(availableJobs(ada).map((j) => j.id)).toContain('paladin');
    const paladin = setLoadout(ada, { job: 'paladin', secondary: 'squire', passive: 'grace', ultimate: 'sanctuary' });
    if ('error' in paladin) throw new Error(paladin.error);

    // The hybrid fights a full battle without any rejected intents.
    const final = play([paladin, ...squad.slice(1)], 8);
    expect(final.turn.phase).toBe('over');
  });
});
