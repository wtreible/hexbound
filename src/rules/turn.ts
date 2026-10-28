import { hurt, resolveAbility } from './abilities';
import { indexOf } from './grid';
import { ability, effectiveStats, grantJp, passiveEffects } from './jobs';
import { roundStart, winner } from './objectives';
import type { Rng } from './rng';
import type { ActiveUnit, Cast, GameEvent, GameState, Hazard, Unit } from './types';
import { isDowned, isEnemy, isNpc, isStanding } from './units';

// CT timeline (docs/DESIGN.md §5.2). Each tick adds spd to every unit's ct; at
// READY_CT a unit is ready. Ready player units act together in a player
// phase (any order), then ready enemies act one at a time in CT order.

export const READY_CT = 100;

/**
 * CT a unit keeps after its turn: nothing if it both moved and acted, more if
 * it skipped one or both. Overflow above READY_CT is not kept, so a unit can
 * never be ready again without the clock ticking.
 */
export const CT_CARRY = { both: 0, one: 60, none: 80 } as const;

/** JP for every surviving player unit when the player side wins (docs/DESIGN.md §6.2). */
export const CLEAR_BONUS_JP = 30;

/** Turn-start damage (and Regen healing) as a share of max HP. */
export const POISON_PCT = 0.1;
export const FIRE_PCT = 0.15;
export const REGEN_PCT = 0.1;

// Safety net: a board where nobody has speed would otherwise loop forever.
const MAX_TICKS = 10_000;

export type Step = { state: GameState; events: GameEvent[] };

/** Ends the battle once its objective is met or lost. A player win pays the clear bonus. */
export function checkVictory(step: Step): Step {
  if (step.state.turn.phase === 'over') return step;
  const w = winner(step.state);
  if (!w) return step;
  const events: GameEvent[] = [...step.events, { type: 'battle-over', winner: w }];
  const units = step.state.units.map((u) => {
    if (w !== 'player' || isEnemy(u) || isNpc(u) || u.dead) return u;
    const gain = grantJp(u, CLEAR_BONUS_JP);
    events.push({ type: 'jp', unitId: u.id, job: u.job, amount: gain.amount, level: gain.level, levelUp: gain.levelUp });
    return gain.unit;
  });
  return { state: { ...step.state, units, turn: { phase: 'over', winner: w } }, events };
}

const byReadiness = (a: Unit, b: Unit) => b.ct - a.ct || (a.id < b.id ? -1 : 1);

/**
 * Runs the clock until the next phase starts (or the battle ends). Charge-time
 * casts resolve as their ticks run out, which needs `rng`.
 */
export function advance(state: GameState, rng?: Rng): Step {
  const events: GameEvent[] = [];
  let units = state.units;
  let hazards = state.hazards;
  let round = state.round;
  let objective = state.objective;
  let casts = state.casts;
  const current = (): GameState => ({ ...state, units, hazards, round, objective, casts });
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // A new round starts once everyone standing has had a turn this round.
    const standingIds = new Set(units.filter(isStanding).map((u) => u.id));
    if (!round.waiting.some((id) => standingIds.has(id))) {
      round = { n: round.n + 1, waiting: [...standingIds] };
      events.push({ type: 'round', n: round.n });
      hazards = tickHazards(hazards, events);
      units = tickDowned(units, events);
      objective = roundStart(objective, units, events);
    }

    const over = checkVictory({ state: current(), events });
    if (over.state.turn.phase === 'over') return over;

    const ready = units.filter((u) => isStanding(u) && u.ct >= READY_CT);
    const players = ready.filter((u) => !isEnemy(u)).sort(byReadiness);
    const enemies = ready.filter(isEnemy).sort(byReadiness);
    const side = players.length ? players : enemies;
    if (side.length) {
      const phase = players.length ? 'player' : 'enemy';
      const onTile = new Map(hazards.map((h) => [indexOf(state.grid, h.pos), h]));
      const ids = new Set(side.map((u) => u.id));
      units = units.map((u) => (ids.has(u.id) ? turnStart(u, onTile.get(indexOf(state.grid, u.pos)), events) : u));
      // Poison or fire can down a unit as its turn begins; it loses that turn.
      const standing = side.filter((u) => isStanding(units.find((x) => x.id === u.id)!));
      const over = checkVictory({ state: current(), events });
      if (over.state.turn.phase === 'over') return over;
      if (!standing.length) continue;
      events.push({ type: 'phase', phase, unitIds: standing.map((u) => u.id) });
      const active: ActiveUnit[] = standing.map((u) => ({ unitId: u.id, moved: false, acted: false }));
      return { state: { ...current(), phaseHits: [], turn: { phase, active } }, events };
    }

    units = units.map((u) => (u.dead || u.escaped ? u : { ...u, ct: u.ct + effectiveStats(u).spd }));

    // Charge-time casts count down with the clock and resolve on their tiles.
    if (casts.length) {
      casts = casts.map((c) => ({ ...c, ticks: c.ticks - 1 }));
      for (const cast of casts.filter((c) => c.ticks <= 0)) {
        const resolved = resolveCast(current(), cast, events, rng);
        units = resolved.units;
        hazards = resolved.hazards;
      }
      casts = casts.filter((c) => c.ticks > 0);
    }
  }
  throw new Error('timeline stalled: no unit can reach READY_CT');
}

/** A cast whose caster is no longer standing fizzles; otherwise it hits whatever is on its tiles now. */
function resolveCast(state: GameState, cast: Cast, events: GameEvent[], rng?: Rng): { units: Unit[]; hazards: Hazard[] } {
  const caster = state.units.find((u) => u.id === cast.casterId);
  if (!caster || !isStanding(caster)) {
    events.push({ type: 'cast-fizzled', unitId: cast.casterId, abilityId: cast.abilityId });
    return { units: state.units, hazards: state.hazards };
  }
  if (!rng) throw new Error('resolving a cast needs an rng');
  events.push({ type: 'cast-resolved', unitId: cast.casterId, abilityId: cast.abilityId });
  // A Jump lands: the caster is back on the board.
  const landed = caster.statuses.some((s) => s.id === 'airborne')
    ? state.units.map((u) => (u.id === caster.id ? { ...u, statuses: u.statuses.filter((s) => s.id !== 'airborne') } : u))
    : state.units;
  if (landed !== state.units) events.push({ type: 'status', unitId: caster.id, status: 'airborne', added: false });
  const r = resolveAbility({ ...state, units: landed }, cast.casterId, ability(cast.abilityId), cast.target, rng, { from: cast.from, paid: true });
  events.push(...r.events);
  return { units: r.units, hazards: r.hazards };
}

/**
 * Start of a unit's turn: poison and burning ground hurt, Regen heals,
 * statuses lose a turn (expiring at 0), and Mana Well restores MP.
 */
function turnStart(unit: Unit, hazard: Hazard | undefined, events: GameEvent[]): Unit {
  let u = unit;
  const max = effectiveStats(u);
  if (u.statuses.some((s) => s.id === 'poison')) u = hurt(u, Math.round(max.hp * POISON_PCT), 'poison', events);
  if (isStanding(u) && hazard?.id === 'fire') u = hurt(u, Math.round(max.hp * FIRE_PCT), 'fire', events);
  if (!isStanding(u)) return u;
  // A friendly rune empowers whoever starts their turn on it.
  if (hazard?.id === 'rune' && (hazard.ownerId === 'enemy') === isEnemy(u)) {
    u = { ...u, statuses: [...u.statuses.filter((s) => s.id !== 'empower'), { id: 'empower', turns: 2 }] };
    events.push({ type: 'status', unitId: u.id, status: 'empower', added: true });
  }
  if (u.statuses.some((s) => s.id === 'regen') && u.hp < max.hp) {
    const amount = Math.min(max.hp - u.hp, Math.max(1, Math.round(max.hp * REGEN_PCT)));
    u = { ...u, hp: u.hp + amount };
    events.push({ type: 'healed', unitId: u.id, amount });
  }

  if (u.statuses.length) {
    const statuses = [];
    for (const s of u.statuses) {
      if (s.turns > 1) statuses.push({ ...s, turns: s.turns - 1 });
      else events.push({ type: 'status', unitId: u.id, status: s.id, added: false });
    }
    u = { ...u, statuses };
  }
  for (const p of passiveEffects(u)) {
    if (p.type !== 'mp-regen') continue;
    const restored = Math.min(p.amount, max.mp - u.mp);
    if (restored > 0) {
      u = { ...u, mp: u.mp + restored };
      events.push({ type: 'mp', unitId: u.id, amount: restored });
    }
  }
  return u;
}

/** At each round start, downed units lose a round; one already at 0 is lost for good. */
function tickDowned(units: Unit[], events: GameEvent[]): Unit[] {
  return units.map((u) => {
    if (!isDowned(u)) return u;
    if (u.downedRounds! > 0) {
      events.push({ type: 'down-tick', unitId: u.id, roundsLeft: u.downedRounds! - 1 });
      return { ...u, downedRounds: u.downedRounds! - 1 };
    }
    events.push({ type: 'died', unitId: u.id });
    const { downedRounds: _, ...rest } = u;
    return { ...rest, dead: true };
  });
}

/** Hazards lose a round at each round start and vanish at 0. */
function tickHazards(hazards: Hazard[], events: GameEvent[]): Hazard[] {
  const next: Hazard[] = [];
  for (const h of hazards) {
    if (h.rounds > 1) next.push({ ...h, rounds: h.rounds - 1 });
    else events.push({ type: 'hazard', hazard: h.id, pos: h.pos, added: false });
  }
  return next;
}

/** Ends one active unit's turn, then advances the clock if the phase is done. */
export function endTurn(state: GameState, unitId: string, rng?: Rng): Step {
  if (state.turn.phase === 'over') return { state, events: [] };
  const entry = state.turn.active.find((a) => a.unitId === unitId);
  if (!entry) return { state, events: [] };
  const carry = entry.moved && entry.acted ? CT_CARRY.both : entry.moved || entry.acted ? CT_CARRY.one : CT_CARRY.none;
  const units = state.units.map((u) => (u.id === unitId ? { ...u, ct: carry } : u));
  const active = state.turn.active.filter((a) => a.unitId !== unitId);
  const events: GameEvent[] = [{ type: 'turn-ended', unitId }];
  const round = { ...state.round, waiting: state.round.waiting.filter((id) => id !== unitId) };
  const next: GameState = { ...state, units, round, turn: { ...state.turn, active } };
  return active.length ? { state: next, events } : prepend(events, advance(next, rng));
}

/**
 * Drops active units that can no longer act (downed mid-phase, e.g. by
 * friendly fire, or escaped) and advances if none remain.
 */
export function pruneActive(step: Step, rng?: Rng): Step {
  const { state } = step;
  if (state.turn.phase === 'over') return step;
  const standing = new Set(state.units.filter(isStanding).map((u) => u.id));
  const active = state.turn.active.filter((a) => standing.has(a.unitId));
  if (active.length === state.turn.active.length) return step;
  const next: GameState = { ...state, turn: { ...state.turn, active } };
  return active.length ? { state: next, events: step.events } : prepend(step.events, advance(next, rng));
}

function prepend(events: GameEvent[], step: Step): Step {
  return { state: step.state, events: [...events, ...step.events] };
}

/**
 * Upcoming turns for the timeline display, assuming every unit uses its full
 * turn. Units acting in the current phase come first.
 */
export function predictOrder(state: GameState, count: number): string[] {
  const order: string[] = [];
  const ct = new Map<string, number>();
  const spd = new Map<string, number>();
  for (const u of state.units.filter(isStanding)) {
    ct.set(u.id, u.ct);
    spd.set(u.id, effectiveStats(u).spd);
  }
  if (state.turn.phase !== 'over') {
    for (const a of state.turn.active) {
      order.push(a.unitId);
      ct.set(a.unitId, CT_CARRY.both);
    }
  }
  const enemy = new Set(state.units.filter(isEnemy).map((u) => u.id));
  for (let tick = 0; order.length < count && tick < MAX_TICKS && ct.size; tick++) {
    const ready = [...ct].filter(([, c]) => c >= READY_CT).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    if (ready.length) {
      const players = ready.filter(([id]) => !enemy.has(id));
      const side = players.length ? players : ready.filter(([id]) => enemy.has(id));
      for (const [id] of side) {
        order.push(id);
        ct.set(id, CT_CARRY.both);
      }
      continue;
    }
    for (const [id, c] of ct) ct.set(id, c + spd.get(id)!);
  }
  return order.slice(0, count);
}
