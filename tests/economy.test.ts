import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { SHRINES } from '../src/data/shrines';
import { BASE_STATS } from '../src/data/units';
import { setupBattle } from '../src/rules/battle';
import { canEquip } from '../src/rules/items';
import { effectiveStats } from '../src/rules/jobs';
import { applyIntent, type IntentResult } from '../src/rules/reducer';
import { createRng } from '../src/rules/rng';
import {
  battleFor,
  buy,
  canChoose,
  changeLoadout,
  choices,
  chooseShrine,
  enterNode,
  equip,
  finishBattle,
  GOLD_REWARD,
  newRun,
  START_GOLD,
  type RunState,
} from '../src/rules/run';
import { battle, flat, makeUnit } from './fixtures';

const rng = createRng(1);
const ok = <T>(r: T | { error: string }): T => {
  if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error);
  return r as T;
};
const draft = [
  { name: 'Ada', job: 'squire', ownerId: 'p1' },
  { name: 'Bram', job: 'archer', ownerId: 'p1' },
];
const start = (seed = 1): RunState => newRun({ seed, draft, base: BASE_STATS, squadSize: 4 });

describe('gear', () => {
  it('needs a weapon tag the job can use; armor fits anyone', () => {
    const squire = makeUnit('s', 'p1', 'squire', { x: 0, y: 0 });
    expect(canEquip(squire, 'iron-sword', 'weapon')).toBe(true);
    expect(canEquip(squire, 'hunting-bow', 'weapon')).toBe(false);
    expect(canEquip(squire, 'iron-sword', 'armor')).toBe(false);
    expect(canEquip(squire, 'cloth-robe', 'armor')).toBe(true);
  });

  it('adds flat stats after job multipliers', () => {
    const squire = makeUnit('s', 'p1', 'squire', { x: 0, y: 0 });
    const geared = { ...squire, gear: { weapon: 'iron-sword', accessory: 'swift-boots' } };
    expect(effectiveStats(geared).atk).toBe(effectiveStats(squire).atk + 3);
    expect(effectiveStats(geared).move).toBe(effectiveStats(squire).move + 1);
  });

  it('equips from the stash, swaps the old item back, and drops a weapon the new job cannot use', () => {
    let run: RunState = { ...start(), stash: ['iron-sword', 'steel-sword'] };
    run = ok(equip(run, 'p0', 'weapon', 'iron-sword'));
    expect(run.squad[0]!.gear?.weapon).toBe('iron-sword');
    expect(run.stash).toEqual(['steel-sword']);
    run = ok(equip(run, 'p0', 'weapon', 'steel-sword'));
    expect(run.stash).toEqual(['iron-sword']);
    expect(equip(run, 'p1', 'weapon', 'iron-sword')).toHaveProperty('error'); // archers can't use swords
    run = ok(changeLoadout(run, 'p0', { job: 'archer' }));
    expect(run.squad[0]!.gear?.weapon).toBeUndefined();
    expect(run.stash.sort()).toEqual(['iron-sword', 'steel-sword']);
  });
});

describe('consumables in battle', () => {
  const ok2 = (r: IntentResult) => {
    if ('error' in r) throw new Error(r.error);
    return r;
  };

  it('can be used by any unit and are used up', () => {
    const s = { ...battle(flat(4, 4), [makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }, { patch: { hp: 5 } }), makeUnit('e', 'enemy', 'squire', { x: 3, y: 3 })], ['a']), inventory: { potion: 1 } };
    const r = ok2(applyIntent(s, { type: 'act', unitId: 'a', abilityId: 'use-potion', target: { x: 0, y: 0 } }, rng));
    expect(r.state.units[0]!.hp).toBe(32);
    expect(r.state.inventory.potion).toBe(0);
    const again = { ...r.state, turn: { phase: 'player' as const, active: [{ unitId: 'a', moved: false, acted: false }] } };
    expect(applyIntent(again, { type: 'act', unitId: 'a', abilityId: 'use-potion', target: { x: 0, y: 0 } }, rng)).toHaveProperty('error');
  });

  it("loots one item from a fallen ally's grave", () => {
    const grave = makeUnit('g', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 0, dead: true, gear: { weapon: 'iron-sword', armor: 'leather-vest' } } });
    const s = battle(flat(4, 4), [makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }), grave, makeUnit('e', 'enemy', 'squire', { x: 3, y: 3 })], ['a']);
    const r = ok2(applyIntent(s, { type: 'move', unitId: 'a', to: { x: 1, y: 0 } }, rng));
    expect(r.events).toContainEqual({ type: 'looted', unitId: 'a', itemId: 'iron-sword' });
    expect(r.state.loot).toEqual(['iron-sword']);
    expect(r.state.units.find((u) => u.id === 'g')!.gear).toEqual({});
  });
});

describe('run economy', () => {
  it('starts with gold and potions and pays more for harder battles', () => {
    let run = start();
    expect(run.gold).toBe(START_GOLD);
    expect(run.inventory).toEqual({ potion: 2 });
    run = ok(enterNode(run, choices(run)[0]!.id, BASE_STATS));
    const { state } = setupBattle(battleFor(run, BASE_STATS).setup);
    const won = finishBattle(run, { ...state, inventory: { potion: 1 }, loot: ['dirk'], turn: { phase: 'over', winner: 'player' } });
    expect(won.gold).toBe(START_GOLD + GOLD_REWARD.battle);
    expect(won.inventory).toEqual({ potion: 1 });
    expect(won.stash).toEqual(['dirk']);
    expect(GOLD_REWARD.elite).toBeGreaterThan(GOLD_REWARD.battle);
    expect(GOLD_REWARD.boss).toBeGreaterThan(GOLD_REWARD.elite);
  });

  it('sells act-tier gear once and consumables without limit', () => {
    const run: RunState = { ...start(), gold: 500, shop: { gear: ['iron-sword', 'dirk'] } };
    const one = ok(buy(run, 'iron-sword'));
    expect(one.gold).toBe(500 - ITEMS['iron-sword']!.price);
    expect(one.stash).toEqual(['iron-sword']);
    expect(one.shop!.gear).toEqual(['dirk']);
    expect(buy(one, 'iron-sword')).toHaveProperty('error');
    const potions = ok(buy(ok(buy(one, 'potion')), 'potion'));
    expect(potions.inventory.potion).toBe(4);
    expect(buy({ ...run, gold: 0 }, 'potion')).toEqual({ error: 'not enough gold' });
  });

  it('applies shrine outcomes and blocks choices the party cannot afford', () => {
    const idol = SHRINES.find((s) => s.id === 'cursed-idol')!;
    const run: RunState = { ...start(), shrine: { eventId: 'cursed-idol' } };
    const taken = ok(chooseShrine(run, 0));
    expect(taken.gold).toBe(START_GOLD + 80);
    expect(taken.squad.every((u) => u.hp < effectiveStats(u).hp)).toBe(true);
    expect(taken.shrine!.result).toBe(idol.choices[0]!.result);
    expect(chooseShrine(taken, 1)).toHaveProperty('error'); // one choice per visit

    const shrine = SHRINES.find((s) => s.id === 'wayside-shrine')!;
    const broke: RunState = { ...start(), gold: 10, shrine: { eventId: 'wayside-shrine' } };
    expect(canChoose(broke, shrine.choices[1]!)).toBe(false);
    expect(chooseShrine(broke, 1)).toEqual({ error: 'not enough gold' });
    const offered = ok(chooseShrine({ ...broke, gold: 30 }, 1));
    expect(offered.squad.reduce((n, u) => n + u.level, 0)).toBe(3);
  });
});
