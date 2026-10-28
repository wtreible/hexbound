import { ABILITIES } from '../data/abilities';
import { affects, areaTiles, damageAmount, healAmount, hitChance, isHostile } from './combat';
import { facingOfStep, indexOf, manhattan, neighbors, stepToward, tileAt } from './grid';
import { ability as abilityById, createUnit, effectiveStats, enemyKnowledge, hasPassive, jobOf, passiveEffects } from './jobs';
import type { Rng } from './rng';
import type { AbilityDef, GameEvent, GameState, Grid, Hazard, Pos, StatusId, Unit } from './types';
import { isDowned, isEnemy, isStanding, sameSide, unitAt } from './units';

// The ability effect pipeline (docs/DESIGN.md §8). Abilities are data; each
// Effect type is handled here once. New behaviours mean new Effect types,
// never per-ability code. Reactions (Counter, Cover) and cross-player combos
// (Ignite) also resolve here.

/** Full rounds a downed unit can wait for a revive before it's lost for good. */
export const DOWNED_ROUNDS = 3;
export const MAX_RESOLVE = 100;

export type PhaseHit = NonNullable<GameState['phaseHits']>[number];
export type Board = { grid: Grid; units: readonly Unit[]; hazards: readonly Hazard[]; phaseHits?: readonly PhaseHit[] };
export type Resolution = { units: Unit[]; hazards: Hazard[]; events: GameEvent[]; phaseHits?: PhaseHit[] };

/** Statuses Dispel strips. */
export const BUFFS: StatusId[] = ['guard', 'haste', 'veil', 'regen', 'protect', 'shell', 'focus', 'empower'];

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
  return { ...unit, hp: 0, ct: 0, downedRounds: DOWNED_ROUNDS, statuses: [] };
}

/** Resolve gained by both sides of a hit: half the damage as a % of the victim's max HP. */
export function resolveGain(amount: number, victimMaxHp: number): number {
  return Math.ceil((50 * amount) / Math.max(1, victimMaxHp));
}

const COMBOS = Object.values(ABILITIES).filter((a) => a.kind === 'combo');

export type ResolveOptions = {
  /** Where the area is measured from: the caster's tile when a charge-time cast began. */
  from?: Pos;
  /** Costs were paid when the cast began (charge-time abilities). */
  paid?: boolean;
};

export function resolveAbility(board: Board, casterId: string, ability: AbilityDef, target: Pos, rng: Rng, opts: ResolveOptions = {}): Resolution {
  const { grid } = board;
  const byId = new Map(board.units.map((u) => [u.id, u]));
  const hazards = new Map(board.hazards.map((h) => [indexOf(grid, h.pos), h]));
  const events: GameEvent[] = [];
  const put = (u: Unit) => byId.set(u.id, u);
  const get = (id: string) => byId.get(id)!;
  const all = () => [...byId.values()];
  const phaseHits: PhaseHit[] = [...(board.phaseHits ?? [])];
  const summoned: Unit[] = [];
  const combos = COMBOS;

  /** Pincer: this attacker and an earlier attacker this phase from another player stand on opposite sides of the target. */
  const flanked = (attacker: Unit, target: Unit): AbilityDef | undefined => {
    const combo = combos.find((c) => c.trigger?.type === 'flank');
    if (!combo || isEnemy(attacker)) return undefined;
    const dx = attacker.pos.x - target.pos.x;
    const dy = attacker.pos.y - target.pos.y;
    const earlier = phaseHits.some(
      (h) =>
        h.targetId === target.id && h.attackerId !== attacker.id && h.ownerId !== attacker.ownerId && h.ownerId !== 'enemy' &&
        (h.from.x - target.pos.x) * dx + (h.from.y - target.pos.y) * dy < 0,
    );
    return earlier ? combo : undefined;
  };

  /** Volley Mark: an ability with the trigger's tag aimed at a foe marked by another player. */
  const markedShot = (a: AbilityDef, attacker: Unit, target: Unit): AbilityDef | undefined => {
    const combo = combos.find((c) => c.trigger?.type === 'marked-shot');
    const t = combo?.trigger;
    if (!combo || !t || t.type !== 'marked-shot' || isEnemy(attacker) || !a.tags.includes(t.tag)) return undefined;
    const mark = target.statuses.find((s) => s.id === t.status);
    return mark && mark.by && mark.by !== 'enemy' && mark.by !== attacker.ownerId ? combo : undefined;
  };

  /** Aegis Link: a heal with the trigger's tag next to another player's ally with Cover heals that ally too. */
  const aegisLink = (a: AbilityDef, healer: Unit, healed: Unit, amount: number) => {
    const combo = combos.find((c) => c.trigger?.type === 'heal-guard');
    const t = combo?.trigger;
    if (!combo || !t || t.type !== 'heal-guard' || isEnemy(healer) || !a.tags.includes(t.tag)) return;
    const guard = all().find(
      (u) => u.id !== healed.id && isStanding(u) && sameSide(u, healed) && u.ownerId !== healer.ownerId && manhattan(u.pos, healed.pos) === 1 && hasPassive(u, 'cover'),
    );
    if (!guard) return;
    const gain = Math.min(amount, effectiveStats(guard).hp - guard.hp);
    put({ ...guard, hp: guard.hp + gain });
    events.push({ type: 'combo', comboId: combo.id, pos: guard.pos });
    events.push({ type: 'healed', unitId: guard.id, amount: gain });
  };

  if (!opts.paid) payAndFace(byId, casterId, ability, target, events);
  const origin = opts.from ?? get(casterId).pos;

  /** Deals damage and hands out Resolve to both sides (plus Arcane Edge MP to the attacker). */
  const damage = (attackerId: string, victimId: string, amount: number) => {
    const v = get(victimId);
    const dealt = Math.min(v.hp, amount);
    const gain = resolveGain(dealt, effectiveStats(v).hp);
    const resolve = Math.min(MAX_RESOLVE, v.resolve + gain);
    events.push({ type: 'damaged', unitId: victimId, amount: dealt });
    if (dealt >= v.hp) {
      put({ ...v, hp: 0, downedRounds: DOWNED_ROUNDS, statuses: [], resolve });
      events.push({ type: 'downed', unitId: victimId });
    } else {
      // Reactions like Auto-Potion heal back a share of the hit.
      let healBack = 0;
      for (const p of passiveEffects(v)) if (p.type === 'reaction-heal') healBack += Math.round(dealt * p.pct);
      put({ ...v, hp: v.hp - dealt + healBack, resolve });
      if (healBack > 0) events.push({ type: 'healed', unitId: victimId, amount: healBack });
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
      // Volley Mark: a shot at a foe another player marked can't miss.
      const marked = markedShot(a, get(sourceId), initial);
      if (marked) events.push({ type: 'combo', comboId: marked.id, pos: initial.pos });
      if (!marked && isHostile(a) && isStanding(initial) && rng.next() >= hitChance(a, get(sourceId), initial)) {
        events.push({ type: 'missed', unitId: id });
        continue;
      }
      for (const effect of a.effects) {
        const u = get(id);
        if (u.dead) break;
        switch (effect.type) {
          case 'damage': {
            if (!isStanding(u)) break;
            const attacker = get(sourceId);
            // Pincer: hit from the side opposite another player's hit this phase, and it counts as from behind.
            const pincer = flanked(attacker, u);
            if (pincer) events.push({ type: 'combo', comboId: pincer.id, pos: u.pos });
            const e = pincer ? { ...effect, forceSide: 'back' as const } : effect;
            damage(sourceId, id, damageAmount(grid, e, attacker, u, a.tags));
            phaseHits.push({ attackerId: sourceId, ownerId: attacker.ownerId, targetId: id, from: attacker.pos });
            damaged.push(id);
            break;
          }
          case 'heal': {
            if (!isStanding(u)) break;
            const amount = Math.min(healAmount(effect, get(sourceId), u), effectiveStats(u).hp - u.hp);
            put({ ...u, hp: u.hp + amount });
            events.push({ type: 'healed', unitId: id, amount });
            aegisLink(a, get(sourceId), get(id), healAmount(effect, get(sourceId), u));
            break;
          }
          case 'status': {
            if (!isStanding(u) || rng.next() >= effect.chance) break;
            const statuses = u.statuses.filter((s) => s.id !== effect.status);
            put({ ...u, statuses: [...statuses, { id: effect.status, turns: effect.duration, by: get(sourceId).ownerId }] });
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
            const { downedRounds: _, ...rest } = u;
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
          case 'dispel': {
            if (!isStanding(u)) break;
            const removed = u.statuses.filter((s) => BUFFS.includes(s.id));
            for (const s of removed) events.push({ type: 'status', unitId: id, status: s.id, added: false });
            put({ ...u, statuses: u.statuses.filter((s) => !BUFFS.includes(s.id)) });
            break;
          }
          case 'hazard':
          case 'summon':
            break; // placed per tile below
        }
      }
    }

    // Summons appear on the aimed tile, or the nearest empty tile beside it.
    for (const effect of a.effects) {
      if (effect.type !== 'summon') continue;
      const spot = [aim, ...neighbors(grid, aim)].find((p) => tileAt(grid, p)?.walkable && !unitAt(all(), p.x, p.y));
      if (!spot) continue;
      const src = get(sourceId);
      const id = `${sourceId}-s${summoned.length + board.units.filter((u) => u.id.startsWith(`${sourceId}-s`)).length}`;
      const unit = {
        ...createUnit({ id, ownerId: src.ownerId, name: effect.name, job: effect.job, base: src.base, pos: spot, facing: src.facing, level: src.level }),
        ...enemyKnowledge(effect.job, src.level),
      };
      summoned.push(unit);
      put(unit);
      events.push({ type: 'summoned', unitId: id });
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

  const tiles = areaTiles(grid, ability, origin, target);
  const damaged = run(ability, casterId, origin, target);

  // Counter: a melee hit on a single unit with Counter gets its basic attack back.
  const struck = damaged.length === 1 ? get(damaged[0]!) : undefined;
  if (struck && ability.tags.includes('melee') && isStanding(struck) && hasPassive(struck, 'counter') && isStanding(get(casterId))) {
    if (manhattan(struck.pos, get(casterId).pos) === 1) {
      const basic = abilityById(jobOf(struck).attack);
      events.push({ type: 'countered', unitId: struck.id, targetId: casterId });
      if (rng.next() >= hitChance(basic, struck, get(casterId))) {
        events.push({ type: 'missed', unitId: casterId });
      } else {
        for (const e of basic.effects) if (e.type === 'damage') damage(struck.id, casterId, damageAmount(grid, e, struck, get(casterId)));
      }
    }
  }

  // Cross-player combos: fire on oil laid by another player's unit explodes (Ignite).
  for (const combo of combos) {
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

  return { units: [...board.units.map((u) => get(u.id)), ...summoned.map((u) => get(u.id))], hazards: [...hazards.values()], events, phaseHits };
}

/**
 * Spends the ability's MP, Resolve and turns the caster to face the target.
 * Consumable counts are the reducer's job (they live on the battle, not the unit).
 */
export function payAndFace(byId: Map<string, Unit>, casterId: string, ability: AbilityDef, target: Pos, events: GameEvent[]): void {
  let caster = byId.get(casterId)!;
  caster = { ...caster, mp: caster.mp - (ability.cost?.mp ?? 0), resolve: caster.resolve - (ability.cost?.resolve ?? 0) };
  if (target.x !== caster.pos.x || target.y !== caster.pos.y) {
    caster = { ...caster, facing: facingOfStep(caster.pos, stepToward(caster.pos, target)) };
    events.push({ type: 'faced', unitId: caster.id, facing: caster.facing });
  }
  byId.set(casterId, caster);
  events.push({ type: 'acted', unitId: caster.id, abilityId: ability.id, target });
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
