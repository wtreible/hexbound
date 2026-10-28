import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { DOWNED_ROUNDS, resolveAbility } from '../src/rules/abilities';
import { gridFromRows } from '../src/rules/grid';
import type { Rng } from '../src/rules/rng';
import { effectiveStats } from '../src/rules/jobs';
import type { Hazard, Unit } from '../src/rules/types';
import { flat, makeUnit } from './fixtures';

/** An Rng whose next() always returns v: 0 always hits, 0.99 misses anything below 99%. */
const fixed = (v: number): Rng => ({ next: () => v, int: (min) => min, state: () => 0 });
const byId = (units: Unit[], id: string) => units.find((u) => u.id === id)!;

describe('resolveAbility', () => {
  const g = gridFromRows(flat(5, 5));

  it('deducts MP, faces the target and damages on a hit', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 }, { facing: 1 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
    const r = resolveAbility({ grid: g, units: [s, a], hazards: [] }, 's', ABILITIES['rally-strike']!, a.pos, fixed(0));
    expect(byId(r.units, 's')).toMatchObject({ mp: 6 - 3, facing: 0 });
    expect(byId(r.units, 'a').hp).toBe(32 - 17); // (15*1.4 - 4) = 17
    expect(r.events.map((e) => e.type)).toEqual(['faced', 'acted', 'damaged']);
  });

  it('misses when the roll is above the hit chance', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { facing: 2 });
    const r = resolveAbility({ grid: g, units: [s, a], hazards: [] }, 's', ABILITIES.strike!, a.pos, fixed(0.9));
    expect(byId(r.units, 'a').hp).toBe(32);
    expect(r.events).toContainEqual({ type: 'missed', unitId: 'a' });
  });

  it('downs a unit at 0 HP, clearing statuses and starting the counter', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 }, { patch: { hp: 3, statuses: [{ id: 'pinned', turns: 2 }] } });
    const r = resolveAbility({ grid: g, units: [s, a], hazards: [] }, 's', ABILITIES.strike!, a.pos, fixed(0));
    expect(byId(r.units, 'a')).toMatchObject({ hp: 0, downedRounds: DOWNED_ROUNDS, statuses: [] });
    expect(r.events).toContainEqual({ type: 'damaged', unitId: 'a', amount: 3 });
    expect(r.events).toContainEqual({ type: 'downed', unitId: 'a' });
  });

  it('pushes the target away, stopping at occupied or higher tiles', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 });
    let r = resolveAbility({ grid: g, units: [s, a], hazards: [] }, 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 1 });

    const blocker = makeUnit('b', 'enemy', 'squire', { x: 2, y: 1 });
    r = resolveAbility({ grid: g, units: [s, a, blocker], hazards: [] }, 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 2 });

    const wall = gridFromRows(['00000', '00100', '00000', '00000', '00000']);
    r = resolveAbility({ grid: wall, units: [s, a], hazards: [] }, 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 2 });
  });

  it('allows pushing off a ledge', () => {
    const ledge = gridFromRows(['00000', '00000', '00200', '00200', '00000']);
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 });
    const r = resolveAbility({ grid: ledge, units: [s, a], hazards: [] }, 's', ABILITIES.shove!, a.pos, fixed(0));
    expect(byId(r.units, 'a').pos).toEqual({ x: 2, y: 1 });
  });

  it('applies statuses by chance', () => {
    const b = makeUnit('b', 'p1', 'archer', { x: 2, y: 4 });
    const a = makeUnit('a', 'enemy', 'squire', { x: 2, y: 1 });
    const pinned = resolveAbility({ grid: g, units: [b, a], hazards: [] }, 'b', ABILITIES['pin-shot']!, a.pos, fixed(0));
    expect(byId(pinned.units, 'a').statuses).toEqual([{ id: 'pinned', turns: 2, by: 'p1' }]);
    // 0.81 hits a side/back shot but fails the 80% status roll.
    const side = makeUnit('a', 'enemy', 'squire', { x: 2, y: 1 }, { facing: 1 });
    const resisted = resolveAbility({ grid: g, units: [b, side], hazards: [] }, 'b', ABILITIES['pin-shot']!, a.pos, fixed(0.81));
    expect(byId(resisted.units, 'a').statuses).toEqual([]);
  });

  it('heals up to max HP, cleanses and revives', () => {
    const c = makeUnit('c', 'p1', 'acolyte', { x: 2, y: 2 });
    const hurt = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 38, statuses: [{ id: 'pinned', turns: 1 }] } });
    let r = resolveAbility({ grid: g, units: [c, hurt], hazards: [] }, 'c', ABILITIES.mend!, hurt.pos, fixed(0.99));
    expect(byId(r.units, 's').hp).toBe(43);
    expect(r.events).toContainEqual({ type: 'healed', unitId: 's', amount: 5 });

    r = resolveAbility({ grid: g, units: [c, hurt], hazards: [] }, 'c', ABILITIES.purify!, hurt.pos, fixed(0.99));
    expect(byId(r.units, 's').statuses).toEqual([]);

    const down = makeUnit('d', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 0, downedRounds: 2 } });
    r = resolveAbility({ grid: g, units: [c, down], hazards: [] }, 'c', ABILITIES.revive!, down.pos, fixed(0.99));
    const revived = byId(r.units, 'd');
    expect(revived.hp).toBe(13); // 30% of 43
    expect(revived.downedRounds).toBeUndefined();
  });

  it('does not heal downed units or damage them further', () => {
    const c = makeUnit('c', 'p1', 'acolyte', { x: 2, y: 2 });
    const down = makeUnit('d', 'p1', 'squire', { x: 2, y: 3 }, { patch: { hp: 0, downedRounds: 2 } });
    expect(byId(resolveAbility({ grid: g, units: [c, down], hazards: [] }, 'c', ABILITIES.mend!, down.pos, fixed(0)).units, 'd').hp).toBe(0);
    const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 4 });
    const r = resolveAbility({ grid: g, units: [c, down, e], hazards: [] }, 'e', ABILITIES.strike!, down.pos, fixed(0));
    expect(r.events.filter((x) => x.type === 'damaged')).toEqual([]);
  });

  it('hits allies caught in an area', () => {
    const b = makeUnit('b', 'p1', 'archer', { x: 2, y: 4 });
    const foe = makeUnit('f', 'enemy', 'squire', { x: 2, y: 1 });
    const friend = makeUnit('s', 'p1', 'squire', { x: 2, y: 0 });
    const r = resolveAbility({ grid: g, units: [b, foe, friend], hazards: [] }, 'b', ABILITIES.volley!, foe.pos, fixed(0));
    expect(byId(r.units, 's').hp).toBeLessThan(43);
    expect(byId(r.units, 'f').hp).toBeLessThan(43);
  });
});

describe('M4 effects and reactions', () => {
  const g = gridFromRows(flat(6, 6));
  const board = (units: Unit[], hazards: Hazard[] = []) => ({ grid: g, units, hazards });

  it('steals MP and changes CT', () => {
    const t = makeUnit('t', 'p1', 'thief', { x: 2, y: 3 }, { patch: { mp: 0 } });
    const m = makeUnit('m', 'enemy', 'mage', { x: 2, y: 2 }, { facing: 0 });
    const r = resolveAbility(board([t, m]), 't', ABILITIES.steal!, m.pos, fixed(0));
    expect(byId(r.units, 'm').mp).toBe(byId([m], 'm').mp - 6);
    expect(byId(r.units, 't').mp).toBe(6);

    const o = makeUnit('o', 'p1', 'mage', { x: 0, y: 0 });
    const foe = makeUnit('f', 'enemy', 'squire', { x: 2, y: 0 }, { patch: { ct: 50 } });
    expect(byId(resolveAbility(board([o, foe]), 'o', ABILITIES.delay!, foe.pos, fixed(0)).units, 'f').ct).toBe(10);
  });

  it('places hazards on walkable tiles, and traps only on empty ones', () => {
    const s = makeUnit('s', 'p1', 'saboteur', { x: 0, y: 0 });
    const r = resolveAbility(board([s]), 's', ABILITIES['oil-slick']!, { x: 2, y: 2 }, fixed(0));
    expect(r.hazards).toHaveLength(5);
    expect(r.hazards.every((h) => h.id === 'oil' && h.ownerId === 'p1' && h.rounds === 4)).toBe(true);

    const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 0 });
    const trapped = resolveAbility(board([s, e]), 's', ABILITIES['land-mine']!, e.pos, fixed(0));
    expect(trapped.hazards).toEqual([]);
  });

  it('only affects the side named by `affects`', () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 0, y: 5 });
    const ally = makeUnit('s', 'p1', 'squire', { x: 2, y: 1 });
    const foe = makeUnit('f', 'enemy', 'squire', { x: 2, y: 2 });
    const r = resolveAbility(board([a, ally, foe]), 'a', ABILITIES['rain-of-arrows']!, { x: 2, y: 2 }, fixed(0));
    expect(byId(r.units, 's').hp).toBe(43);
    expect(byId(r.units, 'f').hp).toBeLessThan(43);
  });

  it('gives Resolve to both sides of a hit and spends it on ultimates', () => {
    const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 }, { patch: { resolve: 100 }, });
    const a = makeUnit('a', 'enemy', 'archer', { x: 2, y: 2 });
    const hit = resolveAbility(board([s, a]), 's', ABILITIES.strike!, a.pos, fixed(0));
    // 11 damage to a 32 HP archer: ceil(50 * 11 / 32) = 18
    expect(byId(hit.units, 'a').resolve).toBe(18);
    expect(byId(hit.units, 's').resolve).toBe(100);
    const ult = resolveAbility(board([{ ...s, hp: 10 }, a]), 's', ABILITIES['last-stand']!, s.pos, fixed(0));
    expect(byId(ult.units, 's').resolve).toBe(0);
  });

  it('redirects single-target attacks to an adjacent ally with Cover', () => {
    const pal = makeUnit('p', 'p1', 'paladin', { x: 3, y: 2 }, { patch: { reaction: 'cover' } });
    const archer = makeUnit('a', 'p1', 'archer', { x: 2, y: 2 });
    const foe = makeUnit('f', 'enemy', 'squire', { x: 2, y: 3 });
    const r = resolveAbility(board([pal, archer, foe]), 'f', ABILITIES.strike!, archer.pos, fixed(0));
    expect(r.events).toContainEqual({ type: 'covered', unitId: 'p', forId: 'a' });
    expect(byId(r.units, 'a').hp).toBe(32);
    expect(byId(r.units, 'p').hp).toBeLessThan(effectiveStats(pal).hp);
  });

  it('strikes back in melee with Counter', () => {
    const sq = makeUnit('s', 'p1', 'squire', { x: 2, y: 2 }, { patch: { reaction: 'counter' } });
    const foe = makeUnit('f', 'enemy', 'archer', { x: 2, y: 3 });
    const r = resolveAbility(board([sq, foe]), 'f', ABILITIES.staff!, sq.pos, fixed(0));
    expect(r.events).toContainEqual({ type: 'countered', unitId: 's', targetId: 'f' });
    expect(byId(r.units, 'f').hp).toBeLessThan(32);
    // Ranged attacks don't provoke it.
    const far = makeUnit('f', 'enemy', 'archer', { x: 2, y: 5 });
    const shot = resolveAbility(board([sq, far]), 'f', ABILITIES.shoot!, sq.pos, fixed(0));
    expect(shot.events.some((e) => e.type === 'countered')).toBe(false);
  });

  it('restores MP on hit with Arcane Edge', () => {
    const sb = makeUnit('b', 'p1', 'spellblade', { x: 2, y: 3 }, { patch: { support: 'arcane-edge', mp: 0 } });
    const foe = makeUnit('f', 'enemy', 'archer', { x: 2, y: 2 });
    expect(byId(resolveAbility(board([sb, foe]), 'b', ABILITIES.strike!, foe.pos, fixed(0)).units, 'b').mp).toBe(2);
  });
});

describe('Ignite', () => {
  const g = gridFromRows(flat(7, 7));
  const oil = (ownerId: string): Hazard => ({ id: 'oil', pos: { x: 3, y: 3 }, rounds: 4, ownerId });
  const units = () => [
    makeUnit('m', 'p2', 'mage', { x: 3, y: 6 }),
    makeUnit('e1', 'enemy', 'squire', { x: 3, y: 3 }),
    makeUnit('e2', 'enemy', 'squire', { x: 3, y: 1 }),
  ];

  it("explodes when fire hits another player's oil", () => {
    const r = resolveAbility({ grid: g, units: units(), hazards: [oil('p1')] }, 'm', ABILITIES.flame!, { x: 3, y: 3 }, fixed(0));
    expect(r.events).toContainEqual({ type: 'combo', comboId: 'ignite', pos: { x: 3, y: 3 } });
    // The blast (radius 2) reaches e2 two tiles away; the target takes both hits.
    expect(byId(r.units, 'e2').hp).toBeLessThan(43);
    expect(r.events.filter((e) => e.type === 'damaged' && e.unitId === 'e1')).toHaveLength(2);
    expect(r.hazards.find((h) => h.pos.x === 3 && h.pos.y === 3)).toMatchObject({ id: 'fire', rounds: 2 });
  });

  it("doesn't trigger on the caster's own oil or the enemy's", () => {
    for (const owner of ['p2', 'enemy']) {
      const r = resolveAbility({ grid: g, units: units(), hazards: [oil(owner)] }, 'm', ABILITIES.flame!, { x: 3, y: 3 }, fixed(0));
      expect(r.events.some((e) => e.type === 'combo')).toBe(false);
    }
  });

  it('needs a fire ability', () => {
    const r = resolveAbility({ grid: g, units: units(), hazards: [oil('p1')] }, 'm', ABILITIES.frost!, { x: 3, y: 3 }, fixed(0));
    expect(r.events.some((e) => e.type === 'combo')).toBe(false);
  });
});
