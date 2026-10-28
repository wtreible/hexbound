import { hurt, payAndFace, resolveAbility, TRAP_EFFECTS, type Resolution } from './abilities';
import { areaTiles } from './combat';
import { escapes } from './objectives';
import { inRange } from './combat';
import { facingOfStep, indexOf, inBounds, pathTo, reachable } from './grid';
import { abilitiesOf, effectiveStats, grantJp, isSilenced } from './jobs';
import { GEAR_SLOTS, itemAbilities } from './items';
import type { Rng } from './rng';
import { checkVictory, endTurn, pruneActive, type Step } from './turn';
import type { AbilityDef, ActiveUnit, Cast, GameEvent, GameState, Intent, Pos, Unit } from './types';
import { findUnit, isEnemy, isStanding, unitAt } from './units';

/** JP per action taken in battle (docs/DESIGN.md §6.2). */
export const ACT_JP = { min: 10, max: 16 } as const;

export type IntentResult = Step | { error: string };

// The single entry point for changing game state (docs/DESIGN.md §8). The host
// runs this for every intent, including in solo play. Returns a new state;
// the input is never mutated.
export function applyIntent(state: GameState, intent: Intent, rng: Rng): IntentResult {
  const { turn } = state;
  if (turn.phase === 'over') return { error: 'battle is over' };
  const unit = findUnit(state.units, intent.unitId);
  if (!unit) return { error: `no unit ${intent.unitId}` };
  const entry = turn.active.find((a) => a.unitId === unit.id);
  if (!entry) return { error: `${unit.name} is not ready` };
  // Enemies act strictly in CT order; players in a phase act in any order.
  if (turn.phase === 'enemy' && turn.active[0]!.unitId !== unit.id) return { error: `not ${unit.name}'s turn` };

  const mark = (patch: Partial<ActiveUnit>): GameState['turn'] => ({
    ...turn,
    active: turn.active.map((a) => (a.unitId === unit.id ? { ...a, ...patch } : a)),
  });

  switch (intent.type) {
    case 'move': {
      if (entry.moved) return { error: 'already moved' };
      if (!inBounds(state.grid, intent.to)) return { error: 'destination out of bounds' };
      const reach = reachable(state.grid, state.units, unit, effectiveStats(unit));
      const node = reach.get(indexOf(state.grid, intent.to));
      if (!node || !node.canStop) return { error: 'destination not reachable' };
      const full = pathTo(state.grid, reach, intent.to);
      if (full.length < 2) return { error: 'already there' };
      // A hostile trap or mine on the way stops the unit there and goes off.
      const hostile = (i: number) => {
        const p = full[i]!;
        const h = state.hazards.find((x) => x.pos.x === p.x && x.pos.y === p.y);
        const enemyOwned = h?.ownerId === 'enemy';
        return h && (h.id === 'trap' || h.id === 'mine') && enemyOwned !== isEnemy(unit) && !unitAt(state.units, p.x, p.y) ? h : undefined;
      };
      let stop = full.length - 1;
      for (let i = 1; i < full.length; i++) if (hostile(i)) { stop = i; break; }
      const path = full.slice(0, stop + 1);
      const to = path[path.length - 1]!;
      const facing = facingOfStep(path[path.length - 2]!, to);
      const events: GameEvent[] = [{ type: 'moved', unitId: unit.id, path }];
      let moved: Unit = { ...unit, pos: to, facing };
      let hazards = state.hazards;
      const trap = hostile(stop);
      if (trap) {
        events.push({ type: 'triggered', unitId: unit.id, hazard: trap.id, pos: to });
        events.push({ type: 'hazard', hazard: trap.id, pos: to, added: false });
        hazards = hazards.filter((h) => h !== trap);
        const kind = trap.id as keyof typeof TRAP_EFFECTS;
        const fx = TRAP_EFFECTS[kind];
        moved = hurt(moved, fx.damage, kind, events);
        if ('status' in fx && isStanding(moved)) {
          moved = { ...moved, statuses: [...moved.statuses.filter((s) => s.id !== fx.status), { id: fx.status, turns: fx.turns }] };
          events.push({ type: 'status', unitId: unit.id, status: fx.status, added: true });
        }
      }
      let units = state.units.map((u) => (u.id === unit.id ? moved : u));
      // A fallen ally's grave can be looted for one of its items; the rest is lost.
      let loot = state.loot;
      const grave = units.find((u) => u.dead && u.pos.x === to.x && u.pos.y === to.y && !isEnemy(u) && u.gear);
      const taken = grave && !isEnemy(unit) && isStanding(moved) ? GEAR_SLOTS.map((s) => grave.gear![s]).find(Boolean) : undefined;
      if (grave && taken) {
        loot = [...loot, taken];
        units = units.map((u) => (u.id === grave.id ? { ...u, gear: {} } : u));
        events.push({ type: 'looted', unitId: unit.id, itemId: taken });
      }
      // Escape objective: stepping onto an exit leaves the battlefield.
      const mover = units.find((u) => u.id === unit.id)!;
      const escaped = escapes({ ...state, units }, mover);
      if (escaped) {
        units = units.map((u) => (u.id === unit.id ? { ...u, escaped: true } : u));
        events.push({ type: 'escaped', unitId: unit.id });
      }
      const next: GameState = { ...state, units, hazards, loot, turn: mark({ moved: true }) };
      return trap || escaped ? pruneActive(checkVictory({ state: next, events }), rng) : checkVictory({ state: next, events });
    }
    case 'act': {
      if (entry.acted) return { error: 'already acted' };
      // Job abilities, or a consumable from the party's shared inventory.
      const item = itemAbilities(state.inventory).find((i) => i.ability.id === intent.abilityId);
      const ability = abilitiesOf(unit).find((a) => a.id === intent.abilityId) ?? item?.ability;
      if (!ability) return { error: `${unit.name} can't use ${intent.abilityId}` };
      if ((ability.cost?.mp ?? 0) > unit.mp) return { error: 'not enough MP' };
      if ((ability.cost?.resolve ?? 0) > unit.resolve) return { error: 'not enough Resolve' };
      if (isSilenced(unit) && ability.tags.includes('magic')) return { error: `${unit.name} is silenced` };
      if (!inRange(state.grid, ability, unit, intent.target)) return { error: 'target out of range' };
      const r: Resolution & { casts?: Cast[] } = ability.chargeTicks
        ? beginCast(state, unit.id, ability, intent.target)
        : resolveAbility(state, unit.id, ability, intent.target, rng);
      // JP for acting goes to the current job (docs/DESIGN.md §6.2).
      const amount = ACT_JP.min + rng.int(0, ACT_JP.max - ACT_JP.min);
      const units = r.units.map((u) => {
        if (u.id !== unit.id || u.dead || isEnemy(u)) return u;
        const gain = grantJp(u, amount);
        r.events.push({ type: 'jp', unitId: u.id, job: u.job, amount: gain.amount, level: gain.level, levelUp: gain.levelUp });
        return gain.unit;
      });
      const inventory = item ? { ...state.inventory, [item.itemId]: item.count - 1 } : state.inventory;
      const next: GameState = {
        ...state,
        units,
        hazards: r.hazards,
        casts: r.casts ?? state.casts,
        phaseHits: r.phaseHits ?? state.phaseHits,
        inventory,
        turn: mark({ acted: true }),
      };
      return pruneActive(checkVictory({ state: next, events: r.events }), rng);
    }
    case 'face': {
      const units = state.units.map((u) => (u.id === unit.id ? { ...u, facing: intent.facing } : u));
      return { state: { ...state, units }, events: [{ type: 'faced', unitId: unit.id, facing: intent.facing }] };
    }
    case 'wait':
      return endTurn(state, unit.id, rng);
  }
}

/**
 * Charge-time abilities (docs/DESIGN.md §5.3): pay now, then resolve on the
 * targeted tiles after `chargeTicks` clock ticks. Units can walk out of the area.
 */
function beginCast(state: GameState, casterId: string, ability: AbilityDef, target: Pos): Resolution & { casts: Cast[] } {
  const byId = new Map(state.units.map((u) => [u.id, u]));
  const events: GameEvent[] = [];
  payAndFace(byId, casterId, ability, target, events);
  const from = byId.get(casterId)!.pos;
  const tiles = areaTiles(state.grid, ability, from, target);
  // Jump: off the board, out of reach, until it lands.
  if (ability.tags.includes('jump')) {
    const caster = byId.get(casterId)!;
    byId.set(casterId, { ...caster, statuses: [...caster.statuses, { id: 'airborne', turns: 99 }] });
    events.push({ type: 'status', unitId: casterId, status: 'airborne', added: true });
  }
  const ticks = ability.chargeTicks!;
  events.push({ type: 'cast', unitId: casterId, abilityId: ability.id, tiles, ticks });
  const casts: Cast[] = [...state.casts, { casterId, abilityId: ability.id, from, target, tiles, ticks }];
  return { units: state.units.map((u) => byId.get(u.id)!), hazards: state.hazards, casts, events };
}
