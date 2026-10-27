import { ABILITIES } from '../data/abilities';
import { affects, areaTiles, damageAmount, healAmount, hitChance, isHostile } from './combat';
import { facingOfStep, indexOf, manhattan, stepToward, tileAt } from './grid';
import { ability as abilityById, effectiveStats, hasPassive, jobOf, passiveEffects } from './jobs';
import type { Rng } from './rng';
import type { AbilityDef, GameEvent, Grid, Hazard, Pos, Unit } from './types';
import { isDowned, isEnemy, isStanding, sameSide, unitAt } from './units';

// The ability effect pipeline (docs/DESIGN.md §8). Abilities are data; each
// Effect type is handled here once. New behaviours mean new Effect types,
// never per-ability code. Reactions (Counter, Cover) and cross-player combos
// (Ignite) also resolve here.

export const DOWNED_TURNS = 3;
export const MAX_RESOLVE = 100;

export type Board = { grid: Grid; units: readonly Unit[]; hazards: readonly Hazard[] };
export type Resolution = { units: Unit[]; hazards: Hazard[]; events: GameEvent[] };

/** What a hostile trap or mine does to the unit that walks onto it. */
export const TRAP_EFFECTS = {
  trap: { damage: 12, status: 'pinned', turns: 2 },
  mine: { damage: 20 },
} as const;

/** Flat damage from the board (poison, fire, traps): no attacker, no Resolve. */
export function hurt(unit: Unit, amount: number, source: 'poison' | 'fire' | 'trap' | 'mine', events: GameEvent[]): Unit {
  const dealt = Math.min(unit.hp, Math.max(1, amount));
  events.push({ type: 'damaged', unitId: unit.id, amount: dealt, source });
  if (dealt < unit.hp) return { ...unit, hp: unit.hp - dealt };
  events.push({ type: 'downed', unitId: unit.id });
  return { ...unit, hp: 0, ct: 0, downedTurns: DOWNED_TURNS, statuses: [] };
}

/** Resolve gained by both sides of a hit: half the damage as a % of the victim's max HP. */
export function resolveGain(amount: number, victimMaxHp: number): number {
  return Math.ceil((50 * amount) / Math.max(1, victimMaxHp));
}

const COMBOS = Object.values(ABILITIES).filter((a) => a.kind === 'combo');

export function resolveAbility(board: Board, casterId: string, ability: AbilityDef, target: Pos, rng: Rng): Resolution {
  const { grid } = board;
  const byId = new Map(board.units.map((u) => [u.id, u]));
  const hazards = new Map(board.hazards.map((h) => [indexOf(grid, h.pos), h]));
  const events: GameEvent[] = [];
  const put = (u: Unit) => byId.set(u.id, u);
  const get = (id: string) => byId.get(id)!;
  const all = () => [...byId.values()];

  let caster = get(casterId);
  caster = {
    ...caster,
    mp: caster.mp - (ability.cost?.mp ?? 0),
    resolve: caster.resolve - (ability.cost?.resolve ?? 0),
  };
  if (target.x !== caster.pos.x || target.y !== caster.pos.y) {
    caster = { ...caster, facing: facingOfStep(caster.pos, stepToward(caster.pos, target)) };
    events.push({ type: 'faced', unitId: caster.id, facing: caster.facing });
  }
  put(caster);
  events.push({ type: 'acted', unitId: caster.id, abilityId: ability.id, target });

  /** Deals damage and hands out Resolve to both sides (plus Arcane Edge MP to the attacker). */
  const damage = (attackerId: string, victimId: string, amount: number) => {
    const v = get(victimId);
    const dealt = Math.min(v.hp, amount);
    const gain = resolveGain(dealt, effectiveStats(v).hp);
    const resolve = Math.min(MAX_RESOLVE, v.resolve + gain);
    events.push({ type: 'damaged', unitId: victimId, amount: dealt });
    if (dealt >= v.hp) {
      put({ ...v, hp: 0, downedTurns: DOWNED_TURNS, statuses: [], resolve });
      events.push({ type: 'downed', unitId: victimId });
    } else {
      put({ ...v, hp: v.hp - dealt, resolve });
    }
    if (attackerId === victimId) return;
    const a = get(attackerId);
    let next = { ...a, resolve: Math.min(MAX_RESOLVE, a.resolve + gain) };
    for (const p of passiveEffects(a)) {
      if (p.type !== 'mp-on-hit') continue;
      const restored = Math.min(p.amount, effectiveStats(a).mp - next.mp);
      if (restored > 0) {
        next = { ...next, mp: next.mp + restored };
        events.push({ type: 'mp', unitId: a.id, amount: restored });
      }
    }
    put(next);
  };

  /** Applies an ability's effects over its area. Returns the ids of units it damaged. */
  const run = (a: AbilityDef, sourceId: string, from: Pos, aim: Pos): string[] => {
    const tiles = areaTiles(grid, a, from, aim);
    const source = get(sourceId);
    let targets = tiles.map((p) => unitAt(all(), p.x, p.y)).filter((u): u is Unit => !!u && affects(a, source, u));

    // Cover: a single-target hostile ability aimed at a unit next to a Paladin hits the Paladin instead.
    if (isHostile(a) && a.area.shape === 'single' && targets.length === 1 && isStanding(targets[0]!)) {
      const aimed = targets[0]!;
      const guard = all().find(
        (u) =>
          u.id !== aimed.id && u.id !== sourceId && isStanding(u) && sameSide(u, aimed) &&
          manhattan(u.pos, aimed.pos) === 1 && hasPassive(u, 'cover'),
      );
      if (guard) {
        events.push({ type: 'covered', unitId: guard.id, forId: aimed.id });
        targets = [guard];
      }
    }

    const damaged: string[] = [];
    for (const initial of targets) {
      const id = initial.id;
      if (isHostile(a) && isStanding(initial) && rng.next() >= hitChance(a, get(sourceId).pos, initial)) {
        events.push({ type: 'missed', unitId: id });
        continue;
      }
      for (const effect of a.effects) {
        const u = get(id);
        if (u.dead) break;
        switch (effect.type) {
          case 'damage':
            if (!isStanding(u)) break;
            damage(sourceId, id, damageAmount(grid, effect, get(sourceId), u));
            damaged.push(id);
            break;
          case 'heal': {
            if (!isStanding(u)) break;
            const amount = Math.min(healAmount(effect, get(sourceId), u), effectiveStats(u).hp - u.hp);
            put({ ...u, hp: u.hp + amount });
            events.push({ type: 'healed', unitId: id, amount });
            break;
          }
          case 'status': {
            if (!isStanding(u) || rng.next() >= effect.chance) break;
            const statuses = u.statuses.filter((s) => s.id !== effect.status);
            put({ ...u, statuses: [...statuses, { id: effect.status, turns: effect.duration }] });
            events.push({ type: 'status', unitId: id, status: effect.status, added: true });
            break;
          }
          case 'cleanse':
            if (!isStanding(u)) break;
            for (const s of u.statuses) events.push({ type: 'status', unitId: id, status: s.id, added: false });
            put({ ...u, statuses: [] });
            break;
          case 'push': {
            if (!isStanding(u)) break;
            const to = pushDestination(grid, all(), get(sourceId).pos, u, effect.distance);
            if (to.x !== u.pos.x || to.y !== u.pos.y) {
              put({ ...u, pos: to });
              events.push({ type: 'pushed', unitId: id, from: u.pos, to });
            }
            break;
          }
          case 'revive': {
            if (!isDowned(u)) break;
            const { downedTurns: _, ...rest } = u;
            put({ ...rest, hp: Math.max(1, Math.round(effectiveStats(u).hp * effect.hpPct)) });
            events.push({ type: 'revived', unitId: id });
            break;
          }
          case 'mp': {
            if (!isStanding(u)) break;
            if (effect.steal) {
              const taken = Math.min(effect.amount, u.mp);
              put({ ...u, mp: u.mp - taken });
              events.push({ type: 'mp', unitId: id, amount: -taken });
              const thief = get(sourceId);
              const gained = Math.min(taken, effectiveStats(thief).mp - thief.mp);
              if (thief.id !== id && gained > 0) {
                put({ ...thief, mp: thief.mp + gained });
                events.push({ type: 'mp', unitId: sourceId, amount: gained });
              }
            } else {
              const restored = Math.min(effect.amount, effectiveStats(u).mp - u.mp);
              put({ ...u, mp: u.mp + restored });
              events.push({ type: 'mp', unitId: id, amount: restored });
            }
            break;
          }
          case 'ct':
            if (!isStanding(u)) break;
            put({ ...u, ct: Math.max(0, u.ct + effect.delta) });
            events.push({ type: 'ct', unitId: id, delta: effect.delta });
            break;
          case 'hazard':
            break; // placed per tile below
        }
      }
    }

    // Hazards go on tiles, not units, and need no hit roll. One hazard per tile: a new one replaces the old.
    for (const effect of a.effects) {
      if (effect.type !== 'hazard') continue;
      for (const p of tiles) {
        if (!tileAt(grid, p)?.walkable) continue;
        if ((effect.hazard === 'trap' || effect.hazard === 'mine') && unitAt(all(), p.x, p.y)) continue;
        hazards.set(indexOf(grid, p), { id: effect.hazard, pos: p, rounds: effect.rounds, ownerId: get(sourceId).ownerId });
        events.push({ type: 'hazard', hazard: effect.hazard, pos: p, added: true });
      }
    }
    return damaged;
  };

  const tiles = areaTiles(grid, ability, caster.pos, target);
  const damaged = run(ability, casterId, caster.pos, target);

  // Counter: a melee hit on a single unit with Counter gets its basic attack back.
  const struck = damaged.length === 1 ? get(damaged[0]!) : undefined;
  if (struck && ability.tags.includes('melee') && isStanding(struck) && hasPassive(struck, 'counter') && isStanding(get(casterId))) {
    if (manhattan(struck.pos, get(casterId).pos) === 1) {
      const basic = abilityById(jobOf(struck).attack);
      events.push({ type: 'countered', unitId: struck.id, targetId: casterId });
      if (rng.next() >= hitChance(basic, struck.pos, get(casterId))) {
        events.push({ type: 'missed', unitId: casterId });
      } else {
        for (const e of basic.effects) if (e.type === 'damage') damage(struck.id, casterId, damageAmount(grid, e, struck, get(casterId)));
      }
    }
  }

  // Cross-player combos: fire on oil laid by another player's unit explodes (Ignite).
  for (const combo of COMBOS) {
    const t = combo.trigger;
    if (!t || t.type !== 'element-on-hazard') continue;
    if (!ability.effects.some((e) => e.type === 'damage' && e.element === t.element)) continue;
    const fuel = tiles
      .map((p) => hazards.get(indexOf(grid, p)))
      .find((h): h is Hazard => h?.id === t.hazard && (!t.crossPlayer || crossPlayer(h.ownerId, get(casterId))));
    if (!fuel) continue;
    events.push({ type: 'combo', comboId: combo.id, pos: fuel.pos });
    run(combo, casterId, fuel.pos, fuel.pos);
  }

  return { units: board.units.map((u) => get(u.id)), hazards: [...hazards.values()], events };
}

/** Combos need two different human players: the caster and whoever laid the hazard. */
function crossPlayer(hazardOwner: string, caster: Unit): boolean {
  return !isEnemy(caster) && hazardOwner !== 'enemy' && hazardOwner !== caster.ownerId;
}

// Knockback moves the target directly away from the attacker. It stops at
// the board edge, unwalkable tiles, occupied tiles and anything higher than
// the tile the target is on; drops of any height are allowed.
function pushDestination(grid: Grid, units: readonly Unit[], from: Pos, target: Unit, distance: number): Pos {
  const step = stepToward(from, target.pos);
  const d = { x: step.x - from.x, y: step.y - from.y };
  let pos = target.pos;
  for (let k = 0; k < distance; k++) {
    const next = { x: pos.x + d.x, y: pos.y + d.y };
    const here = tileAt(grid, pos)!;
    const there = tileAt(grid, next);
    if (!there || !there.walkable || there.height > here.height || unitAt(units, next.x, next.y)) break;
    pos = next;
  }
  return pos;
}
