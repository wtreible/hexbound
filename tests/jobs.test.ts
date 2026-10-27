import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { previewAct } from '../src/rules/combat';
import { gridFromRows } from '../src/rules/grid';
import {
  abilityEntries,
  availableJobs,
  effectiveStats,
  grantJp,
  passiveOptions,
  rankForJp,
  rangeBonus,
  secondaryOptions,
  setLoadout,
  ultimateOptions,
} from '../src/rules/jobs';
import type { Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

const withJp = (u: Unit, jp: Record<string, number>): Unit => ({ ...u, jp: { ...u.jp, ...jp } });
const ok = (r: Unit | { error: string }): Unit => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('ranks', () => {
  it('come from JP thresholds 60 / 150 / 300', () => {
    expect([0, 59, 60, 149, 150, 299, 300, 999].map(rankForJp)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('report rank-ups when JP crosses a threshold', () => {
    const u = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });
    expect(grantJp(u, 59)).toMatchObject({ rank: 0, rankUp: false });
    const g = grantJp(grantJp(u, 59).unit, 1);
    expect(g).toMatchObject({ rank: 1, rankUp: true });
    expect(g.unit.jp.squire).toBe(60);
  });
});

describe('abilityEntries', () => {
  it('locks primary abilities above the current rank', () => {
    const u = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });
    const locked = (x: Unit) => Object.fromEntries(abilityEntries(x).map((e) => [e.ability.id, e.locked]));
    expect(locked(u)).toEqual({ strike: false, 'rally-strike': false, guard: true, shove: true });
    expect(locked(withJp(u, { squire: 60 }))).toMatchObject({ guard: false, shove: true });
  });

  it("adds the secondary job's unlocked abilities and the equipped ultimate", () => {
    const u = { ...withJp(makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }), { archer: 300 }), secondary: 'archer', ultimate: 'rain-of-arrows' };
    const entries = abilityEntries(u).filter((e) => e.source === 'secondary' || e.source === 'ultimate');
    expect(entries.map((e) => e.ability.id)).toEqual(['aim', 'pin-shot', 'volley', 'rain-of-arrows']);
  });
});

describe('unlocks', () => {
  const fresh = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });

  it('offers every base job, and a hybrid once both parents are mastered', () => {
    expect(availableJobs(fresh).map((j) => j.id)).toEqual(['squire', 'archer', 'mage', 'acolyte', 'thief', 'chemist']);
    const both = withJp(fresh, { squire: 300, acolyte: 300 });
    expect(availableJobs(both).map((j) => j.id)).toContain('paladin');
    expect(availableJobs(withJp(fresh, { squire: 300, acolyte: 299 })).map((j) => j.id)).not.toContain('paladin');
  });

  it('allows secondaries from Rank 1, passives from Rank 2 and ultimates on mastery', () => {
    const u = withJp(fresh, { archer: 60, mage: 150, thief: 300 });
    expect(secondaryOptions(u).map((j) => j.id)).toEqual(['archer', 'mage', 'thief']);
    expect(passiveOptions(u).map((a) => a.id)).toEqual(['mana-well', 'fleet']);
    expect(ultimateOptions(u).map((a) => a.id)).toEqual(['shadow-step']);
  });
});

describe('setLoadout', () => {
  const fresh = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });

  it('switches to an unlocked hybrid and refills HP/MP to the new maximums', () => {
    const u = ok(setLoadout({ ...withJp(fresh, { squire: 300, acolyte: 300 }), hp: 1 }, { job: 'paladin' }));
    expect(u.job).toBe('paladin');
    expect(u.jp.paladin).toBe(0);
    expect(u.jp.squire).toBe(300);
    expect(u.hp).toBe(effectiveStats(u).hp);
  });

  it('rejects anything not unlocked', () => {
    expect(setLoadout(fresh, { job: 'paladin' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', secondary: 'archer' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', passive: 'counter' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', ultimate: 'last-stand' })).toHaveProperty('error');
    const ranked = withJp(fresh, { archer: 60 });
    expect(setLoadout(ranked, { job: 'archer', secondary: 'archer' })).toHaveProperty('error');
  });

  it('clears slots that are left out', () => {
    const u = { ...withJp(fresh, { archer: 300 }), secondary: 'archer', passive: 'eagle-eye', ultimate: 'rain-of-arrows' };
    const next = ok(setLoadout(u, { job: 'squire' }));
    expect(next.secondary).toBeUndefined();
    expect(next.passive).toBeUndefined();
    expect(next.ultimate).toBeUndefined();
  });
});

describe('passives', () => {
  it('add stats (Fleet)', () => {
    const thief = makeUnit('t', 'p1', 'thief', { x: 0, y: 0 });
    expect(effectiveStats(thief).move).toBe(5);
    expect(effectiveStats({ ...thief, passive: 'fleet' }).move).toBe(6);
  });

  it('add range by tag (Eagle Eye on bows only)', () => {
    const a = { ...makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }), passive: 'eagle-eye' };
    expect(rangeBonus(a, ABILITIES.shoot!)).toBe(1);
    expect(rangeBonus(a, ABILITIES.strike!)).toBe(0);
  });

  it('boost healing (Grace)', () => {
    const g = gridFromRows(flat(3, 1));
    const c = { ...makeUnit('c', 'p1', 'acolyte', { x: 0, y: 0 }), passive: 'grace' };
    const hurt = makeUnit('s', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 1 } });
    // mag 17 * 0.8 = 13.6, * 1.2 = 16.3 -> 16
    expect(previewAct(g, [c, hurt], c, ABILITIES.mend!, hurt.pos)[0]!.heal).toBe(16);
  });
});
