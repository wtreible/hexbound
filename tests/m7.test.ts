import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { BASE_STATS } from '../src/data/units';
import { planTurn, presetFor } from '../src/rules/ai';
import { resolveAbility } from '../src/rules/abilities';
import { damageAmount, MARK_BONUS, hitChance } from '../src/rules/combat';
import { gridFromRows } from '../src/rules/grid';
import { effectiveStats } from '../src/rules/jobs';
import { applyIntent } from '../src/rules/reducer';
import type { Rng } from '../src/rules/rng';
import { createRng } from '../src/rules/rng';
import { advance } from '../src/rules/turn';
import type { Effect, GameState, Unit } from '../src/rules/types';
import { battle, flat, makeUnit } from './fixtures';

// M7 mechanics (decisions 0023, 0024): new statuses, the three new combos,
// summons, Jump, runes, and the AI's enemy presets.

const g = gridFromRows(flat(6, 6));
const fixed = (v: number): Rng => ({ next: () => v, int: (min) => min, state: () => 0 });
const byId = (units: Unit[], id: string) => units.find((u) => u.id === id)!;
const strike = ABILITIES.strike!.effects[0] as Extract<Effect, { type: 'damage' }>;

describe('status modifiers', () => {
  const s = makeUnit('s', 'p1', 'squire', { x: 2, y: 3 });
  const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 2 });
  const plain = damageAmount(g, strike, s, e);
  const withStatus = (u: Unit, id: Unit['statuses'][number]['id']): Unit => ({ ...u, statuses: [{ id, turns: 2 }] });

  it('Weaken and Empower scale the attacker, Protect cuts physical damage taken', () => {
    expect(damageAmount(g, strike, withStatus(s, 'weaken'), e)).toBeLessThan(plain);
    expect(damageAmount(g, strike, withStatus(s, 'empower'), e)).toBeGreaterThan(plain);
    expect(damageAmount(g, strike, s, withStatus(e, 'protect'))).toBeLessThan(plain);
    // Shell is for magic only.
    expect(damageAmount(g, strike, s, withStatus(e, 'shell'))).toBe(plain);
  });

  it('Mark makes a foe easier to hit', () => {
    const shot = ABILITIES.shoot!;
    const a = makeUnit('a', 'p1', 'archer', { x: 2, y: 5 });
    const far = { ...e, pos: { x: 2, y: 0 } };
    expect(hitChance(shot, a, withStatus(far, 'mark'))).toBeCloseTo(Math.min(1, hitChance(shot, a, far) + MARK_BONUS / 100));
  });

  it('Dispel strips helpful statuses and leaves harmful ones', () => {
    const h = makeUnit('h', 'p1', 'hexer', { x: 2, y: 4 });
    const buffed = { ...e, statuses: [{ id: 'protect' as const, turns: 2 }, { id: 'haste' as const, turns: 2 }, { id: 'poison' as const, turns: 2 }] };
    const r = resolveAbility({ grid: g, units: [h, buffed], hazards: [] }, 'h', ABILITIES.dispel!, buffed.pos, fixed(0));
    expect(byId(r.units, 'e').statuses.map((x) => x.id)).toEqual(['poison']);
  });
});

describe('cross-player combos', () => {
  it('Pincer: a hit opposite another player\'s hit this phase counts as from behind', () => {
    const a = makeUnit('a', 'p1', 'squire', { x: 2, y: 3 });
    const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 2 }, { facing: 2 });
    const phaseHits = [{ attackerId: 'b', ownerId: 'p2', targetId: 'e', from: { x: 2, y: 1 } }];
    const r = resolveAbility({ grid: g, units: [a, e], hazards: [], phaseHits }, 'a', ABILITIES.strike!, e.pos, fixed(0));
    expect(r.events).toContainEqual({ type: 'combo', comboId: 'pincer', pos: e.pos });
    // The same player's own earlier hit doesn't count.
    const own = resolveAbility({ grid: g, units: [a, e], hazards: [], phaseHits: [{ ...phaseHits[0]!, ownerId: 'p1' }] }, 'a', ABILITIES.strike!, e.pos, fixed(0));
    expect(own.events.some((x) => x.type === 'combo')).toBe(false);
  });

  it("Volley Mark: a bow shot at a foe another player marked can't miss", () => {
    const a = makeUnit('a', 'p1', 'archer', { x: 2, y: 5 });
    const e = makeUnit('e', 'enemy', 'squire', { x: 2, y: 1 }, { patch: { statuses: [{ id: 'mark', turns: 2, by: 'p2' }] } });
    const r = resolveAbility({ grid: g, units: [a, e], hazards: [] }, 'a', ABILITIES.shoot!, e.pos, fixed(0.999));
    expect(r.events).toContainEqual({ type: 'combo', comboId: 'volley-mark', pos: e.pos });
    expect(byId(r.units, 'e').hp).toBeLessThan(e.hp);
    // Marked by the shooter's own player: just the Mark's hit bonus, no combo.
    const self = { ...e, statuses: [{ id: 'mark' as const, turns: 2, by: 'p1' }] };
    const own = resolveAbility({ grid: g, units: [a, self], hazards: [] }, 'a', ABILITIES.shoot!, e.pos, fixed(0.999));
    expect(own.events.some((x) => x.type === 'combo')).toBe(false);
  });

  it("Aegis Link: a holy heal next to another player's unit with Cover heals it too", () => {
    const c = makeUnit('c', 'p1', 'acolyte', { x: 0, y: 0 });
    const hurt = makeUnit('s', 'p1', 'squire', { x: 1, y: 0 }, { patch: { hp: 5 } });
    const guard = makeUnit('p', 'p2', 'paladin', { x: 2, y: 0 }, { patch: { hp: 5, reaction: 'cover' } });
    const r = resolveAbility({ grid: g, units: [c, hurt, guard], hazards: [] }, 'c', ABILITIES.mend!, hurt.pos, fixed(0));
    expect(r.events).toContainEqual({ type: 'combo', comboId: 'aegis-link', pos: guard.pos });
    expect(byId(r.units, 'p').hp).toBeGreaterThan(5);
    // No Cover, no link.
    const plain = resolveAbility({ grid: g, units: [c, hurt, { ...guard, reaction: undefined }], hazards: [] }, 'c', ABILITIES.mend!, hurt.pos, fixed(0));
    expect(byId(plain.units, 'p').hp).toBe(5);
  });
});

describe('summons', () => {
  it('Raise Dead puts a skeleton on the aimed tile, on the caster\'s side', () => {
    const n = makeUnit('n', 'enemy', 'necromancer', { x: 0, y: 0 });
    const r = resolveAbility({ grid: g, units: [n], hazards: [] }, 'n', ABILITIES['raise-dead']!, { x: 0, y: 2 }, fixed(0));
    const risen = byId(r.units, 'n-s0');
    expect(risen).toMatchObject({ ownerId: 'enemy', job: 'grunt', name: 'Risen', pos: { x: 0, y: 2 } });
    expect(r.events).toContainEqual({ type: 'summoned', unitId: 'n-s0' });
    // A second summon gets a fresh id; an occupied tile shifts it next door.
    const again = resolveAbility({ grid: g, units: r.units, hazards: [] }, 'n', ABILITIES['raise-dead']!, { x: 0, y: 2 }, fixed(0));
    expect(byId(again.units, 'n-s1').pos).not.toEqual({ x: 0, y: 2 });
  });
});

describe('Jump', () => {
  it('lifts the dragoon off the board until the jump lands, where nothing can hit it', () => {
    const d = makeUnit('d', 'p1', 'dragoon', { x: 0, y: 0 }, { patch: { learned: ['jump'] } });
    const e = makeUnit('e', 'enemy', 'squire', { x: 0, y: 3 });
    const s = battle(flat(6, 6), [d, e], ['d']);
    const r = applyIntent(s, { type: 'act', unitId: 'd', abilityId: 'jump', target: e.pos }, createRng(1));
    if ('error' in r) throw new Error(r.error);
    expect(byId(r.state.units, 'd').statuses.map((x) => x.id)).toContain('airborne');
    // An enemy strike aimed at the dragoon's tile finds nobody.
    const swing = resolveAbility({ ...r.state, units: r.state.units.map((u) => (u.id === 'e' ? { ...u, pos: { x: 0, y: 1 } } : u)) }, 'e', ABILITIES.strike!, d.pos, fixed(0));
    expect(swing.events.some((x) => x.type === 'damaged')).toBe(false);
  });
});

describe('runes', () => {
  it('Empower whoever on their side starts a turn on one', () => {
    const k = makeUnit('k', 'p1', 'runeknight', { x: 1, y: 1 }, { patch: { ct: 100 } });
    const state: GameState = {
      grid: g,
      units: [k, makeUnit('e', 'enemy', 'squire', { x: 5, y: 5 })],
      hazards: [{ id: 'rune', pos: { x: 1, y: 1 }, rounds: 3, ownerId: 'p1' }],
      round: { n: 0, waiting: [] },
      inventory: {},
      loot: [],
      objective: { type: 'rout' },
      casts: [],
      turn: { phase: 'player', active: [] },
    };
    expect(byId(advance(state).state.units, 'k').statuses.map((x) => x.id)).toContain('empower');
  });
});

describe('AI presets', () => {
  it('gives enemies their job\'s preset, the escort NPC escort, and players cautious', () => {
    expect(presetFor(makeUnit('n', 'enemy', 'necromancer', { x: 0, y: 0 }))).toBe('coward');
    expect(presetFor(makeUnit('h', 'enemy', 'cult-healer', { x: 0, y: 0 }))).toBe('healer');
    expect(presetFor(makeUnit('p', 'npc', 'squire', { x: 0, y: 0 }))).toBe('escort');
    expect(presetFor(makeUnit('s', 'p1', 'squire', { x: 0, y: 0 }))).toBe('cautious');
  });

  it("closes in when nothing is in reach, so wary units can't stall a battle", () => {
    const sniper = makeUnit('e', 'enemy', 'sniper', { x: 0, y: 0 }, { base: BASE_STATS });
    const far = makeUnit('p', 'p1', 'squire', { x: 0, y: 19 });
    const s = battle(flat(3, 20), [sniper, far], ['e'], 'enemy');
    const move = planTurn(s, 'e').find((i) => i.type === 'move');
    expect(move).toBeDefined();
    expect(move!.type === 'move' && move!.to.y).toBeGreaterThan(0);
  });
});

it('keeps summons and new statuses plain data', () => {
  const n = makeUnit('n', 'enemy', 'necromancer', { x: 0, y: 0 });
  const r = resolveAbility({ grid: g, units: [n], hazards: [] }, 'n', ABILITIES['raise-dead']!, { x: 0, y: 2 }, fixed(0));
  expect(JSON.parse(JSON.stringify(r.units))).toEqual(r.units);
  expect(effectiveStats(byId(r.units, 'n-s0')).hp).toBeGreaterThan(0);
});
