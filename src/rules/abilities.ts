import { areaTiles, damageAmount, healAmount, hitChance, isHostile } from './combat';
import { facingOfStep, stepToward, tileAt } from './grid';
import { effectiveStats } from './jobs';
import type { Rng } from './rng';
import type { AbilityDef, GameEvent, Grid, Pos, Unit } from './types';
import { isDowned, isStanding, unitAt } from './units';

// The ability effect pipeline (DESIGN.md §8). Abilities are data; each Effect
// type is handled here once. New behaviours mean new Effect types, never
// per-ability code.

export const DOWNED_TURNS = 3;

export type Resolution = { units: Unit[]; events: GameEvent[] };

export function resolveAbility(
  grid: Grid,
  units: readonly Unit[],
  casterId: string,
  ability: AbilityDef,
  target: Pos,
  rng: Rng,
): Resolution {
  const byId = new Map(units.map((u) => [u.id, u]));
  const events: GameEvent[] = [];
  const put = (u: Unit) => byId.set(u.id, u);
  const get = (id: string) => byId.get(id)!;

  let caster = get(casterId);
  caster = { ...caster, mp: caster.mp - (ability.cost?.mp ?? 0) };
  if (target.x !== caster.pos.x || target.y !== caster.pos.y) {
    caster = { ...caster, facing: facingOfStep(caster.pos, stepToward(caster.pos, target)) };
    events.push({ type: 'faced', unitId: caster.id, facing: caster.facing });
  }
  put(caster);
  events.push({ type: 'acted', unitId: caster.id, abilityId: ability.id, target });

  // Targets are fixed when the ability fires; pushes don't pull in new ones.
  const targets = areaTiles(grid, ability, caster.pos, target)
    .map((p) => unitAt([...byId.values()], p.x, p.y))
    .filter((u): u is Unit => !!u);

  for (const initial of targets) {
    const id = initial.id;
    if (isHostile(ability) && isStanding(initial) && rng.next() >= hitChance(ability, caster.pos, initial)) {
      events.push({ type: 'missed', unitId: id });
      continue;
    }
    for (const effect of ability.effects) {
      const u = get(id);
      if (u.dead) break;
      switch (effect.type) {
        case 'damage': {
          if (!isStanding(u)) break;
          const amount = Math.min(u.hp, damageAmount(grid, effect, get(casterId), u));
          events.push({ type: 'damaged', unitId: id, amount });
          if (amount >= u.hp) {
            put({ ...u, hp: 0, downedTurns: DOWNED_TURNS, statuses: [] });
            events.push({ type: 'downed', unitId: id });
          } else {
            put({ ...u, hp: u.hp - amount });
          }
          break;
        }
        case 'heal': {
          if (!isStanding(u)) break;
          const amount = Math.min(healAmount(effect, get(casterId)), effectiveStats(u).hp - u.hp);
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
        case 'cleanse': {
          if (!isStanding(u)) break;
          for (const s of u.statuses) events.push({ type: 'status', unitId: id, status: s.id, added: false });
          put({ ...u, statuses: [] });
          break;
        }
        case 'push': {
          if (!isStanding(u)) break;
          const to = pushDestination(grid, [...byId.values()], get(casterId).pos, u, effect.distance);
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
      }
    }
  }

  return { units: units.map((u) => get(u.id)), events };
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
