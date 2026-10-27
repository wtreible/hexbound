import { describe, expect, it } from 'vitest';
import { banditGroup } from '../src/data/enemies';
import { meadow } from '../src/data/maps/meadow';
import { BASE_STATS, testSquad } from '../src/data/units';
import { planTurn } from '../src/rules/ai';
import { setupBattle } from '../src/rules/battle';
import { applyIntent } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import type { GameState } from '../src/rules/types';
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
    const { state } = setupBattle({ rows: meadow.rows, spawns: meadow.spawns, squad: testSquad.map((m) => ({ ...m, ownerId: 'p1' })), enemies: banditGroup, base: BASE_STATS });
    expect(() => runPlan(state, state.turn.phase === 'over' ? '' : state.turn.active[0]!.unitId)).not.toThrow();
  });
});

describe('full battle', () => {
  // Both sides driven by the berserker AI: the meadow battle must reach a
  // result from start to finish without stalling or a rejected intent.
  it.each([1, 2, 3, 4, 5])('finishes with a winner (seed %i)', (seed) => {
    let { state } = setupBattle({ rows: meadow.rows, spawns: meadow.spawns, squad: testSquad.map((m) => ({ ...m, ownerId: 'p1' })), enemies: banditGroup, base: BASE_STATS });
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
