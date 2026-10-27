import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { areaTiles, attackSide, damageAmount, hitChance, inRange, previewAct } from '../src/rules/combat';
import { gridFromRows } from '../src/rules/grid';
import { effectiveStats } from '../src/rules/jobs';
import type { Effect, Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

const strike = ABILITIES.strike!;
const hit = strike.effects[0] as Extract<Effect, { type: 'damage' }>;

// Level-1 stats from BASE_STATS and the job multipliers in data/jobs.ts.
describe('effectiveStats', () => {
  it('applies job multipliers and fixed move/jump', () => {
    const s = effectiveStats(makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }));
    expect(s).toMatchObject({ hp: 43, atk: 15, def: 5, spd: 6, move: 4, jump: 2 });
    expect(effectiveStats(makeUnit('b', 'p1', 'archer', { x: 0, y: 0 })).spd).toBe(7);
  });

  it('applies guard and pinned', () => {
    const u = makeUnit('a', 'p1', 'squire', { x: 0, y: 0 }, { patch: { statuses: [{ id: 'guard', turns: 1 }, { id: 'pinned', turns: 2 }] } });
    expect(effectiveStats(u)).toMatchObject({ def: 8, move: 2 });
  });
});

describe('attackSide', () => {
  // Target faces south (+y).
  const target = makeUnit('t', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
  it('classifies front, back and side by dominant axis', () => {
    expect(attackSide({ x: 2, y: 3 }, target)).toBe('front');
    expect(attackSide({ x: 2, y: 0 }, target)).toBe('back');
    expect(attackSide({ x: 3, y: 2 }, target)).toBe('side');
    expect(attackSide({ x: 3, y: 3 }, target)).toBe('side'); // diagonal ties go to side
    expect(attackSide({ x: 3, y: 5 }, target)).toBe('front');
  });
});

describe('damageAmount', () => {
  const g = gridFromRows(flat(5, 5));
  const squire = (x: number, y: number) => makeUnit('s', 'p1', 'squire', { x, y });
  const archer = (facing: 0 | 1 | 2 | 3) => makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { facing });

  it('is stat * power - defence on flat ground from the front', () => {
    expect(damageAmount(g, hit, squire(2, 3), archer(2))).toBe(11);
  });

  it('adds 10% from the side and 25% from behind', () => {
    expect(damageAmount(g, hit, squire(3, 2), archer(2))).toBe(12); // 12.1
    expect(damageAmount(g, hit, squire(2, 1), archer(2))).toBe(14); // 13.75
  });

  it('adds 10% per tier above the target, capped at 30%', () => {
    const hills = gridFromRows(['00000', '00000', '00000', '00200', '00500']);
    expect(damageAmount(hills, hit, squire(2, 3), archer(2))).toBe(13); // 2 tiers: 13.2
    const tall = gridFromRows(['00000', '00000', '00000', '00900', '00000']);
    expect(damageAmount(tall, hit, squire(2, 3), archer(2))).toBe(14); // capped: 14.3
  });

  it('gives no bonus for attacking uphill', () => {
    const hill = gridFromRows(['00000', '00000', '00300', '00000', '00000']);
    expect(damageAmount(hill, hit, squire(2, 3), archer(2))).toBe(11);
  });

  it('never goes below 1', () => {
    const acolyte = makeUnit('c', 'p1', 'acolyte', { x: 2, y: 3 });
    const guarded = makeUnit('g', 'enemy', 'squire', { x: 2, y: 2 }, { patch: { statuses: [{ id: 'guard', turns: 1 }] } });
    expect(damageAmount(g, ABILITIES.staff!.effects[0] as typeof hit, acolyte, guarded)).toBe(1);
  });
});

describe('hitChance', () => {
  const target = makeUnit('t', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
  const at = (x: number, y: number, statuses: Unit['statuses'] = []) => makeUnit('s', 'p1', 'squire', { x, y }, { patch: { statuses } });
  it('is 90% minus evade from the front, improved by facing', () => {
    expect(hitChance(strike, at(2, 3), target)).toBe(0.85);
    expect(hitChance(strike, at(3, 2), target)).toBe(1);
    expect(hitChance(strike, at(2, 1), target)).toBe(1);
  });

  it('drops 40 points when the attacker is blind', () => {
    expect(hitChance(strike, at(2, 3, [{ id: 'blind', turns: 2 }]), target)).toBe(0.45);
  });

  it('always lands for magic and non-hostile abilities', () => {
    expect(hitChance(ABILITIES.mend!, at(2, 3), target)).toBe(1);
    expect(hitChance(ABILITIES.guard!, at(2, 3), target)).toBe(1);
  });
});

describe('inRange', () => {
  const archerAt0 = makeUnit('b', 'p1', 'archer', { x: 0, y: 0 });
  it('respects min and max distance', () => {
    const g = gridFromRows(flat(8, 1));
    const shoot = ABILITIES.shoot!;
    expect(inRange(g, shoot, archerAt0, { x: 1, y: 0 })).toBe(false);
    expect(inRange(g, shoot, archerAt0, { x: 4, y: 0 })).toBe(true);
    expect(inRange(g, shoot, archerAt0, { x: 5, y: 0 })).toBe(false);
  });

  it('gives bows +1 range per 2 tiers above the target', () => {
    const g = gridFromRows(['40000000']);
    expect(inRange(g, ABILITIES.shoot!, archerAt0, { x: 6, y: 0 })).toBe(true);
    expect(inRange(g, ABILITIES.shoot!, archerAt0, { x: 7, y: 0 })).toBe(false);
    expect(inRange(g, strike, archerAt0, { x: 2, y: 0 })).toBe(false);
  });
});

describe('areaTiles', () => {
  const g = gridFromRows(flat(5, 5));
  const key = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).sort();
  it('builds a cross clipped to the board', () => {
    expect(areaTiles(g, ABILITIES.volley!, { x: 4, y: 4 }, { x: 2, y: 2 })).toHaveLength(5);
    expect(key(areaTiles(g, ABILITIES.volley!, { x: 4, y: 4 }, { x: 0, y: 0 }))).toEqual(['0,0', '0,1', '1,0']);
  });

  it('extends lines and cones away from the caster', () => {
    const line = { ...strike, area: { shape: 'line' as const, size: 2 } };
    expect(key(areaTiles(g, line, { x: 0, y: 2 }, { x: 1, y: 2 }))).toEqual(['1,2', '2,2', '3,2']);
    const cone = { ...strike, area: { shape: 'cone' as const, size: 1 } };
    expect(key(areaTiles(g, cone, { x: 0, y: 2 }, { x: 1, y: 2 }))).toEqual(['1,2', '2,1', '2,2', '2,3']);
  });
});

describe('previewAct', () => {
  it('reports damage, hit chance and whether the target goes down', () => {
    const g = gridFromRows(flat(3, 3));
    const s = makeUnit('s', 'p1', 'squire', { x: 1, y: 2 });
    const weak = makeUnit('a', 'enemy', 'archer', { x: 1, y: 1 }, { facing: 2, patch: { hp: 5 } });
    const [p] = previewAct(g, [s, weak], s, strike, weak.pos);
    expect(p).toMatchObject({ damage: 11, hitChance: 0.85, downs: true });
  });

  it('caps healing at missing HP', () => {
    const g = gridFromRows(flat(3, 1));
    const c = makeUnit('c', 'p1', 'acolyte', { x: 0, y: 0 });
    const hurt = makeUnit('s', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 40 } });
    expect(previewAct(g, [c, hurt], c, ABILITIES.mend!, hurt.pos)[0]!.heal).toBe(3);
  });
});
