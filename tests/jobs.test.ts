import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { JOBS } from '../src/data/jobs';
import { previewAct } from '../src/rules/combat';
import { gridFromRows } from '../src/rules/grid';
import {
  abilityEntries,
  availableJobs,
  effectiveStats,
  enemyKnowledge,
  grantJp,
  isMastered,
  learn,
  levelForJp,
  missingRequirements,
  rangeBonus,
  secondaryOptions,
  setLoadout,
  slotOptions,
} from '../src/rules/jobs';
import type { Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

/** Gives JP in each job as if earned (spendable and counted towards job levels). */
const withJp = (u: Unit, jp: Record<string, number>): Unit => ({ ...u, jp: { ...u.jp, ...jp }, jpTotal: { ...u.jpTotal, ...jp } });
const ok = (r: Unit | { error: string }): Unit => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('job levels', () => {
  it('come from total JP earned in the job: 100 / 250 / 450 / 700 / 1000 / 1400 / 1900', () => {
    expect([0, 99, 100, 249, 250, 449, 450, 1899, 1900, 9999].map(levelForJp)).toEqual([1, 1, 2, 2, 3, 3, 4, 7, 8, 8]);
  });

  it('report level-ups, and count JP spent on abilities', () => {
    const u = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });
    expect(grantJp(u, 99)).toMatchObject({ level: 1, levelUp: false });
    const g = grantJp(grantJp(u, 99).unit, 1);
    expect(g).toMatchObject({ level: 2, levelUp: true });
    const spent = ok(learn(g.unit, 'squire', 'throw-stone'));
    expect(spent.jp.squire).toBe(40);
    expect(spent.jpTotal.squire).toBe(100);
    expect(grantJp(spent, 10).level).toBe(2);
  });

  it('earn more with JP Boost', () => {
    const u = { ...makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }), support: 'jp-boost' };
    expect(grantJp(u, 20).amount).toBe(30);
  });
});

describe('learning', () => {
  const fresh = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });

  it("starts each unit knowing its job's first action", () => {
    expect(fresh.learned).toEqual(['rally-strike']);
  });

  it("spends the job's JP on one of its abilities", () => {
    const u = ok(learn(withJp(fresh, { squire: 100 }), 'squire', 'throw-stone'));
    expect(u.learned).toContain('throw-stone');
    expect(u.jp.squire).toBe(40);
  });

  it('rejects abilities that are too expensive, already known, or from another job', () => {
    expect(learn(withJp(fresh, { squire: 59 }), 'squire', 'throw-stone')).toHaveProperty('error');
    expect(learn(withJp(fresh, { squire: 100 }), 'squire', 'rally-strike')).toHaveProperty('error');
    expect(learn(withJp(fresh, { squire: 100 }), 'squire', 'aim')).toHaveProperty('error');
    // Archer JP buys archer abilities, wherever the unit is now.
    expect(ok(learn(withJp(fresh, { archer: 50 }), 'archer', 'aim')).learned).toContain('aim');
  });

  it('masters a job once every ability is learned', () => {
    const all = JOBS.squire!.abilities.map((a) => a.abilityId);
    expect(isMastered({ ...fresh, learned: all.slice(1) }, 'squire')).toBe(false);
    expect(isMastered({ ...fresh, learned: all }, 'squire')).toBe(true);
  });
});

describe('abilityEntries', () => {
  it('lists the attack and learned primary actions, not unlearned ones or passives', () => {
    const u = { ...makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }), learned: ['rally-strike', 'throw-stone', 'counter'] };
    expect(abilityEntries(u).map((e) => [e.ability.id, e.source])).toEqual([
      ['strike', 'attack'],
      ['rally-strike', 'primary'],
      ['throw-stone', 'primary'],
    ]);
  });

  it("adds the secondary job's learned actions and the equipped ultimate", () => {
    const u = { ...makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }), learned: ['rally-strike', 'aim', 'volley', 'rain-of-arrows'], secondary: 'archer', ultimate: 'rain-of-arrows' };
    const entries = abilityEntries(u).filter((e) => e.source === 'secondary' || e.source === 'ultimate');
    expect(entries.map((e) => e.ability.id)).toEqual(['aim', 'volley', 'rain-of-arrows']);
  });
});

describe('the job tree', () => {
  const fresh = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });

  it('offers every starting job, and an advanced job once its required job levels are reached', () => {
    expect(availableJobs(fresh).map((j) => j.id)).toEqual(['squire', 'archer', 'mage', 'acolyte', 'thief', 'chemist']);
    expect(missingRequirements(fresh, 'paladin')).toBe('Squire Lv 3, Acolyte Lv 2');
    const ready = withJp(fresh, { squire: 250, acolyte: 100 });
    expect(availableJobs(ready).map((j) => j.id)).toContain('paladin');
    expect(missingRequirements(ready, 'paladin')).toBe('');
    expect(availableJobs(withJp(fresh, { squire: 250, acolyte: 99 })).map((j) => j.id)).not.toContain('paladin');
  });

  it('opens tier 3 jobs through tier 2 ones', () => {
    const templar = JOBS.templar!;
    expect(templar.tier).toBe(3);
    expect(templar.requires).toContainEqual({ job: 'paladin', level: 4 });
    expect(availableJobs(withJp(fresh, { squire: 250, acolyte: 100, mage: 250 })).map((j) => j.id)).not.toContain('templar');
    expect(availableJobs(withJp(fresh, { squire: 250, acolyte: 100, mage: 250, paladin: 450 })).map((j) => j.id)).toContain('templar');
  });

  it('allows a secondary only from jobs with a learned action, and slots only learned abilities of that kind', () => {
    const u = { ...fresh, learned: ['rally-strike', 'aim', 'mana-well', 'fleet', 'counter', 'shadow-step'] };
    expect(secondaryOptions(u).map((j) => j.id)).toEqual(['archer']);
    expect(slotOptions(u, 'reaction').map((a) => a.id)).toEqual(['counter']);
    expect(slotOptions(u, 'support').map((a) => a.id)).toEqual(['mana-well']);
    expect(slotOptions(u, 'movement').map((a) => a.id)).toEqual(['fleet']);
    expect(slotOptions(u, 'ultimate').map((a) => a.id)).toEqual(['shadow-step']);
  });
});

describe('setLoadout', () => {
  const fresh = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 });

  it('switches to an unlocked advanced job, keeping HP (no free heal) and refilling MP', () => {
    const u = ok(setLoadout({ ...withJp(fresh, { squire: 250, acolyte: 100 }), hp: 10, mp: 0 }, { job: 'paladin' }));
    expect(u.job).toBe('paladin');
    expect(u.jp.paladin).toBe(0);
    expect(u.jp.squire).toBe(250);
    expect(u.hp).toBe(10);
    expect(u.mp).toBe(effectiveStats(u).mp);
  });

  it('rejects anything locked or unlearned', () => {
    expect(setLoadout(fresh, { job: 'paladin' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', secondary: 'archer' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', reaction: 'counter' })).toHaveProperty('error');
    expect(setLoadout(fresh, { job: 'squire', ultimate: 'last-stand' })).toHaveProperty('error');
    // An ability in the wrong slot.
    expect(setLoadout({ ...fresh, learned: ['counter'] }, { job: 'squire', support: 'counter' })).toHaveProperty('error');
    // A job can't be its own secondary.
    expect(setLoadout({ ...fresh, learned: ['aim'] }, { job: 'archer', secondary: 'archer' })).toHaveProperty('error');
  });

  it('equips learned abilities and clears slots that are left out', () => {
    const learned = { ...fresh, learned: ['rally-strike', 'aim', 'counter', 'eagle-eye', 'fleet', 'rain-of-arrows'] };
    const full = ok(setLoadout(learned, { job: 'squire', secondary: 'archer', reaction: 'counter', support: 'eagle-eye', movement: 'fleet', ultimate: 'rain-of-arrows' }));
    expect(full).toMatchObject({ secondary: 'archer', reaction: 'counter', support: 'eagle-eye', movement: 'fleet', ultimate: 'rain-of-arrows' });
    const next = ok(setLoadout(full, { job: 'squire' }));
    for (const slot of ['secondary', 'reaction', 'support', 'movement', 'ultimate'] as const) expect(next[slot]).toBeUndefined();
  });
});

describe('enemyKnowledge', () => {
  it('knows what its level could have bought, without ultimates', () => {
    const lv1 = enemyKnowledge('squire', 1);
    expect(lv1.learned).toEqual(['rally-strike', 'throw-stone', 'guard', 'shove']);
    const lv4 = enemyKnowledge('squire', 4);
    expect(lv4.learned).toContain('counter');
    expect(lv4.reaction).toBe('counter');
    expect(lv4.learned).not.toContain('last-stand');
  });

  it('knows every ability of an enemy-only job', () => {
    expect(enemyKnowledge('necromancer', 1).learned).toEqual(JOBS.necromancer!.abilities.map((a) => a.abilityId));
  });
});

describe('passives', () => {
  it('add stats (Fleet)', () => {
    const thief = makeUnit('t', 'p1', 'thief', { x: 0, y: 0 });
    expect(effectiveStats(thief).move).toBe(5);
    expect(effectiveStats({ ...thief, movement: 'fleet' }).move).toBe(6);
  });

  it('add range by tag (Eagle Eye on bows only)', () => {
    const a = { ...makeUnit('a', 'p1', 'archer', { x: 0, y: 0 }), support: 'eagle-eye' };
    expect(rangeBonus(a, ABILITIES.shoot!)).toBe(1);
    expect(rangeBonus(a, ABILITIES.strike!)).toBe(0);
  });

  it('boost healing (Grace)', () => {
    const g = gridFromRows(flat(3, 1));
    const c = { ...makeUnit('c', 'p1', 'acolyte', { x: 0, y: 0 }), support: 'grace' };
    const hurt = makeUnit('s', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 1 } });
    // mag 17 * 0.8 = 13.6, * 1.2 = 16.3 -> 16
    expect(previewAct(g, [c, hurt], c, ABILITIES.mend!, hurt.pos)[0]!.heal).toBe(16);
  });
});
