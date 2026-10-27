import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { DOWNED_TURNS, resolveAbility } from '../src/rules/abilities';
import { gridFromRows } from '../src/rules/grid';
import type { Rng } from '../src/rules/rng';
import type { Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

/** An Rng whose next() always returns v: 0 always hits, 0.99 misses anything below 99%. */
const fixed = (v: number): Rng => ({ next: () => v, int: (min) => min, state: () => 0 });
const byId = (units: Unit[], id: string) => units.find((u) => u.id === id)!;

describe('resolveAbility', () => {
  const g = gridFromRows(flat(5, 5));

  it('deducts MP, faces the target and damages on a hit', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 }, { facing: 1 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
    const r = resolveAbility(g, [s, a], 's', ABILITIES['rally-strike']!, a.pos, fixed(0));
    expect(byId(r.units, 's')).toMatchObject({ mp: 6 - 3, facing: 0 });
    expect(byId(r.units, 'a').hp).toBe(32 - 17); // (15*1.4 - 4) = 17
    expect(r.events.map((e) => e.type)).toEqual(['faced', 'acted', 'damaged']);
  });

  it('misses when the roll is above the hit chance', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
    const r = resolveAbility(g, [s, a], 's', ABILITIES.strike!, a.pos, fixed(0.9));
    expect(byId(r.units, 'a').hp).toBe(32);
    expect(r.events).toContainEqual({ type: 'missed', unitId: 'a' });
  });

  it('downs a unit at 0 HP, clearing statuses and starting the counter', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { patch: { hp: 3, statuses: [{ id: 'pinned', turns: 2 }] } });
    const r = resolveAbility(g, [s, a], 's', ABILITIES.strike!, a.pos, fixed(0));
    expect(byId(r.units, 'a')).toMatchObject({ hp: 0, downedTurns: DOWNED_TURNS, statuses: [] });
    expect(r.events).toContainEqual({ type: 'damaged', unitId: 'a', amount: 3 });
    expect(r.events).toContainEqual({ type: 'downed', unitId: 'a' });
  });

  it('pushes the target away, stopping at occupied or higher tiles', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 });
    let r = resolveAbility(g, [s, a], 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 1 });

    const blocker = makeUnit('b', 'enemy', 'squire', { x: 2, y: 1 });
    r = resolveAbility(g, [s, a, blocker], 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 2 });

    const wall = gridFromRows(['00000', '00100', '00000', '00000', '00000']);
    r = resolveAbility(wall, [s, a], 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 2 });
  });

  it('allows pushing off a ledge', () => {
    const ledge = gridFromRows(['00000', '00000', '00200', '00200', '00000']);
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 });
    const r = resolveAbility(ledge, [s, a], 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 1 });
  });

  it('applies statuses by chance', () => {
    const b = makeUnit('b', 'p1', 'archer', { x: 2, y: 4 });
    const a = makeUnit('a', 'enemy', 'squire', { x: 2, y: 1 });
    const pinned = resolveAbility(g, [b, a], 'b', ABILITIES['pin-shot']!, a.pos, fixed(0));
    expect(byId(pinned.units, 'a').statuses).toEqual([{ id: 'pinned', turns: 2 }]);
    // 0.81 hits a side/back shot but fails the 80% status roll.
    const side = makeUnit('a', 'enemy', 'squire', { x: 2, y: 1 }, { facing: 1 });
    const resisted = resolveAbility(g, [b, side], 'b', ABILITIES['pin-shot']!, a.pos, fixed(0.81));
    expect(byId(resisted.units, 'a').statuses).toEqual([]);
  });

  it('heals up to max HP, cleanses and revives', () => {
    const c = makeUnit('c', 'p1', 'acolyte', { x: 2, y: 2 });
    const hurt = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 38, statuses: [{ id: 'pinned', turns: 1 }] } });
    let r = resolveAbility(g, [c, hurt], 'c', ABILITIES.mend!, hurt.pos, fixed(0.99));
    expect(byId(r.units, 's').hp).toBe(43);
    expect(r.events).toContainEqual({ type: 'healed', unitId: 's', amount: 5 });

    r = resolveAbility(g, [c, hurt], 'c', ABILITIES.purify!, hurt.pos, fixed(0.99));
    expect(byId(r.units, 's').statuses).toEqual([]);

    const down = makeUnit('d', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 0, downedTurns: 2 } });
    r = resolveAbility(g, [c, down], 'c', ABILITIES.revive!, down.pos, fixed(0.99));
    const revived = byId(r.units, 'd');
    expect(revived.hp).toBe(13); // 30% of 43
    expect(revived.downedTurns).toBeUndefined();
  });

  it('does not heal downed units or damage them further', () => {
    const c = makeUnit('c', 'p1', 'acolyte', { x: 2, y: 2 });
    const down = makeUnit('d', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 0, downedTurns: 2 } });
    expect(byId(resolveAbility(g, [c, down], 'c', ABILITIES.mend!, down.pos, fixed(0)).units, 'd').hp).toBe(0);
    const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 4 });
    const r = resolveAbility(g, [c, down, e], 'e', ABILITIES.strike!, down.pos, fixed(0));
    expect(r.events.filter((x) => x.type === 'damaged')).toEqual([]);
  });

  it('hits allies caught in an area', () => {
    const b = makeUnit('b', 'p1', 'archer', { x: 2, y: 4 });
    const foe = makeUnit('f', 'enemy', 'squire', { x: 2, y: 1 });
    const friend = makeUnit('s', 'p1', 'squire', { x: 2, y: 0 });
    const r = resolveAbility(g, [b, foe, friend], 'b', ABILITIES.volley!, foe.pos, fixed(0));
    expect(byId(r.units, 's').hp).toBeLessThan(43);
    expect(byId(r.units, 'f').hp).toBeLessThan(43);
  });
});
