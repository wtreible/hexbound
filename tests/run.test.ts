import { describe, expect, it } from 'vitest';
import { ACT_LEVEL, BOSS_SCALE } from '../src/data/encounters';
import { BASE_STATS } from '../src/data/units';
import { planTurn } from '../src/rules/ai';
import { setupBattle } from '../src/rules/battle';
import { effectiveStats } from '../src/rules/jobs';
import { applyIntent } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import {
  ACTS,
  battleFor,
  CHOICE_ROWS,
  choices,
  enterNode,
  finishBattle,
  generateMap,
  isBattle,
  leaveNode,
  newRun,
  node,
  recruit,
  rest,
  type RunState,
} from '../src/rules/run';
import type { GameState } from '../src/rules/types';

const draft = [
  { name: 'Ada', job: 'squire', ownerId: 'p1' },
  { name: 'Bram', job: 'archer', ownerId: 'p1' },
  { name: 'Cora', job: 'acolyte', ownerId: 'p1' },
  { name: 'Dain', job: 'mage', ownerId: 'p1' },
];
const start = (seed = 1) => newRun({ seed, draft, base: BASE_STATS, squadSize: 4 });
const ok = (r: RunState | { error: string }): RunState => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('generateMap', () => {
  it('builds 3 acts of choice rows ending in a boss, the same for the same seed', () => {
    const nodes = generateMap(createRng(5));
    expect(nodes.filter((n) => n.type === 'boss').map((n) => n.id)).toEqual(['1-boss', '2-boss', '3-boss']);
    for (let act = 1; act <= ACTS; act++) {
      for (let row = 0; row < CHOICE_ROWS; row++) {
        const count = nodes.filter((n) => n.act === act && n.row === row).length;
        expect(count).toBeGreaterThanOrEqual(2);
        expect(count).toBeLessThanOrEqual(3);
      }
      // A camp is always offered right before each boss.
      expect(nodes.some((n) => n.act === act && n.row === CHOICE_ROWS - 1 && n.type === 'camp')).toBe(true);
    }
    expect(generateMap(createRng(5))).toEqual(nodes);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('connects every node, and every path reaches the final boss (seed %i)', (seed) => {
    const nodes = generateMap(createRng(seed));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const reached = new Set<string>();
    const queue = nodes.filter((n) => n.act === 1 && n.row === 0).map((n) => n.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (reached.has(id)) continue;
      reached.add(id);
      const n = byId.get(id)!;
      if (n.id !== '3-boss') expect(n.next.length).toBeGreaterThan(0);
      queue.push(...n.next);
    }
    expect(reached.size).toBe(nodes.length);
  });
});

describe('moving through the run', () => {
  it('only allows the offered choices', () => {
    const run = start();
    const first = choices(run);
    expect(first.every((n) => n.act === 1 && n.row === 0 && n.type === 'battle')).toBe(true);
    expect(enterNode(run, '1-2-0', BASE_STATS)).toHaveProperty('error');
    const entered = ok(enterNode(run, first[0]!.id, BASE_STATS));
    expect(entered).toMatchObject({ status: 'node', at: first[0]!.id, visited: [first[0]!.id] });
    expect(choices(entered)).toEqual([]);
  });

  it('sets up a deterministic battle at the act level', () => {
    const run = ok(enterNode(start(), choices(start())[0]!.id, BASE_STATS));
    const a = battleFor(run, BASE_STATS);
    expect(battleFor(run, BASE_STATS)).toEqual(a);
    expect(a.encounter.act).toBe(1);
    expect(a.setup.enemies.every((e) => e.level === ACT_LEVEL[1])).toBe(true);
  });
});

describe('finishBattle', () => {
  const won = (run: RunState, patch: (s: GameState) => GameState = (s) => s): RunState => {
    const { state } = setupBattle(battleFor(run, BASE_STATS).setup);
    const over = patch({ ...state, turn: { phase: 'over', winner: 'player' } });
    return finishBattle(run, over);
  };

  it('keeps HP, levels up survivors and records the dead', () => {
    const run = ok(enterNode(start(), choices(start())[0]!.id, BASE_STATS));
    const after = won(run, (s) => ({
      ...s,
      units: s.units.map((u) => (u.id === 'p0' ? { ...u, hp: 10 } : u.id === 'p1' ? { ...u, hp: 0, dead: true } : u.id === 'p2' ? { ...u, hp: 0, downedRounds: 2 } : u)),
    }));
    expect(after.status).toBe('map');
    expect(after.battlesWon).toBe(1);
    expect(after.squad.map((u) => u.name)).toEqual(['Ada', 'Cora', 'Dain']);
    expect(after.squad.every((u) => u.level === 2)).toBe(true);
    // A wounded unit gains however much its max HP grew with the level.
    const ada = run.squad[0]!;
    const grown = effectiveStats(after.squad[0]!).hp - effectiveStats(ada).hp;
    expect(grown).toBeGreaterThan(0);
    expect(after.squad[0]!.hp).toBe(10 + grown);
    expect(after.squad[1]!.hp).toBeGreaterThanOrEqual(1);
    expect(after.fallen).toEqual([{ name: 'Bram', job: 'archer', level: 1 }]);
  });

  it('ends the run on a loss', () => {
    const run = ok(enterNode(start(), choices(start())[0]!.id, BASE_STATS));
    const { state } = setupBattle(battleFor(run, BASE_STATS).setup);
    const lost = finishBattle(run, { ...state, turn: { phase: 'over', winner: 'enemy' } });
    expect(lost.status).toBe('lost');
    expect(lost.squad).toEqual([]);
    expect(lost.fallen).toHaveLength(4);
  });

  it('makes bosses tougher than their escorts', () => {
    const run: RunState = { ...start(), at: '1-boss', status: 'node' };
    const { setup } = battleFor(run, BASE_STATS);
    expect(setup.enemies[0]!.scale).toEqual(BOSS_SCALE);
    const { state } = setupBattle(setup);
    const [bossUnit, escort] = state.units.filter((u) => u.ownerId === 'enemy');
    expect(effectiveStats(bossUnit!).hp).toBeGreaterThan(2 * effectiveStats(escort!).hp);
  });
});

describe('camp and recruits', () => {
  /** Follows a path to the first node of the type; returns the run just before entering it. */
  const walkTo = (type: string, firstSeed = 1): { before: RunState; id: string } => {
    // Use the first seed from firstSeed on whose map has the node type.
    let seed = firstSeed;
    while (!start(seed).nodes.some((n) => n.type === type)) if (++seed > firstSeed + 50) throw new Error(`no ${type} found`);
    let run = start(seed);
    const target = run.nodes.find((n) => n.type === type)!;
    // Breadth-first search back from the target to a starting node.
    const prev = new Map<string, string | null>(choices(run).map((n) => [n.id, null]));
    const queue = [...prev.keys()];
    while (queue.length && !prev.has(target.id)) {
      const id = queue.shift()!;
      for (const next of node(run, id).next) if (!prev.has(next)) (prev.set(next, id), queue.push(next));
    }
    const path: string[] = [];
    for (let id: string | null = target.id; id !== null; id = prev.get(id) ?? null) path.unshift(id);
    for (const id of path.slice(0, -1)) run = { ...ok(enterNode(run, id, BASE_STATS)), status: 'map' };
    return { before: run, id: target.id };
  };
  const at = (type: string, seed = 1): RunState => {
    const { before, id } = walkTo(type, seed);
    return ok(enterNode(before, id, BASE_STATS));
  };

  it('rests once per camp visit for half max HP', () => {
    const run = at('camp');
    const hurt = { ...run, squad: run.squad.map((u) => ({ ...u, hp: 1 })) };
    const rested = rest(hurt);
    const max = effectiveStats(rested.squad[0]!).hp;
    expect(rested.squad[0]!.hp).toBe(1 + Math.round(max / 2));
    expect(rest(rested)).toBe(rested);
    expect(leaveNode(rested)).toMatchObject({ status: 'map' });
  });

  it('offers recruits at the average level minus one, one per visit, only with room', () => {
    const { before, id } = walkTo('recruit', 3);
    let run = ok(enterNode(before, id, BASE_STATS));
    expect(run.recruits).toHaveLength(3);
    expect(recruit(run, run.recruits![0]!.id)).toEqual({ error: 'the squad is full' });

    const shorthanded = { ...before, squad: before.squad.slice(0, 3).map((u) => ({ ...u, level: 4 })) };
    run = ok(enterNode(shorthanded, id, BASE_STATS));
    expect(run.recruits!.every((u) => u.level === 3)).toBe(true);
    const joined = ok(recruit(run, run.recruits![1]!.id));
    expect(joined.squad).toHaveLength(4);
    expect(joined.recruits).toEqual([]);
    expect(new Set(joined.squad.map((u) => u.id)).size).toBe(4);
  });
});

describe('a whole run', () => {
  // Drives runs with the AI on both sides, always taking the first choice,
  // resting at camps and recruiting when there's room.
  function play(seed: number): RunState {
    let run = start(seed);
    for (let steps = 0; run.status === 'map' || run.status === 'node'; steps++) {
      if (steps > 100) throw new Error('run did not finish');
      if (run.status === 'map') {
        run = ok(enterNode(run, choices(run)[0]!.id, BASE_STATS));
        continue;
      }
      const n = node(run, run.at!);
      if (isBattle(n.type)) {
        const b = battleFor(run, BASE_STATS);
        let { state } = setupBattle(b.setup);
        const rng = createRng(b.seed);
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
        run = finishBattle(run, state);
      } else {
        if (n.type === 'camp') run = rest(run);
        if (n.type === 'recruit' && run.recruits?.length && run.squad.length < run.squadSize) run = ok(recruit(run, run.recruits[0]!.id));
        run = leaveNode(run);
      }
    }
    return run;
  }

  it.each([1, 2, 3])('plays from the first node to a win or a loss (seed %i)', (seed) => {
    const run = play(seed);
    expect(['won', 'lost']).toContain(run.status);
    expect(run.visited.length).toBeGreaterThan(0);
    // JSON round-trip: the whole run must be plain data for saving.
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});
