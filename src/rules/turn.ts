import { effectiveStats } from './jobs';
import type { ActiveUnit, GameEvent, GameState, Unit } from './types';
import { isDowned, isEnemy, isStanding } from './units';

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

// Safety net: a board where nobody has speed would otherwise loop forever.
const MAX_TICKS = 10_000;

export type Step = { state: GameState; events: GameEvent[] };

export function winner(units: readonly Unit[]): 'player' | 'enemy' | null {
  if (!units.some((u) => isEnemy(u) && isStanding(u))) return 'player';
  if (!units.some((u) => !isEnemy(u) && isStanding(u))) return 'enemy';
  return null;
}

/** Ends the battle if one side has no standing units left. */
export function checkVictory(step: Step): Step {
  if (step.state.turn.phase === 'over') return step;
  const w = winner(step.state.units);
  if (!w) return step;
  return {
    state: { ...step.state, turn: { phase: 'over', winner: w } },
    events: [...step.events, { type: 'battle-over', winner: w }],
  };
}

const byReadiness = (a: Unit, b: Unit) => b.ct - a.ct || (a.id < b.id ? -1 : 1);

/**
 * Runs the clock until the next phase starts (or the battle ends). Downed
 * units spend their would-be turns counting down to permanent death.
 */
export function advance(state: GameState): Step {
  const events: GameEvent[] = [];
  let units = state.units;
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    // Downed units that come up lose a turn from their counter instead of acting.
    units = units.map((u) => {
      if (!isDowned(u) || u.ct < READY_CT) return u;
      const turnsLeft = u.downedTurns! - 1;
      if (turnsLeft > 0) {
        events.push({ type: 'down-tick', unitId: u.id, turnsLeft });
        return { ...u, ct: 0, downedTurns: turnsLeft };
      }
      events.push({ type: 'died', unitId: u.id });
      const { downedTurns: _, ...rest } = u;
      return { ...rest, ct: 0, dead: true };
    });

    const over = checkVictory({ state: { ...state, units }, events });
    if (over.state.turn.phase === 'over') return over;

    const ready = units.filter((u) => isStanding(u) && u.ct >= READY_CT);
    const players = ready.filter((u) => !isEnemy(u)).sort(byReadiness);
    const enemies = ready.filter(isEnemy).sort(byReadiness);
    const side = players.length ? players : enemies;
    if (side.length) {
      const phase = players.length ? 'player' : 'enemy';
      const ids = new Set(side.map((u) => u.id));
      units = units.map((u) => (ids.has(u.id) ? tickStatuses(u, events) : u));
      events.push({ type: 'phase', phase, unitIds: side.map((u) => u.id) });
      const active: ActiveUnit[] = side.map((u) => ({ unitId: u.id, moved: false, acted: false }));
      return { state: { ...state, units, turn: { phase, active } }, events };
    }

    units = units.map((u) => (u.dead ? u : { ...u, ct: u.ct + effectiveStats(u).spd }));
  }
  throw new Error('timeline stalled: no unit can reach READY_CT');
}

/** Statuses lose a turn when their unit's turn starts, and expire at 0. */
function tickStatuses(u: Unit, events: GameEvent[]): Unit {
  if (!u.statuses.length) return u;
  const statuses = [];
  for (const s of u.statuses) {
    if (s.turns > 1) statuses.push({ ...s, turns: s.turns - 1 });
    else events.push({ type: 'status', unitId: u.id, status: s.id, added: false });
  }
  return { ...u, statuses };
}

/** Ends one active unit's turn, then advances the clock if the phase is done. */
export function endTurn(state: GameState, unitId: string): Step {
  if (state.turn.phase === 'over') return { state, events: [] };
  const entry = state.turn.active.find((a) => a.unitId === unitId);
  if (!entry) return { state, events: [] };
  const carry = entry.moved && entry.acted ? CT_CARRY.both : entry.moved || entry.acted ? CT_CARRY.one : CT_CARRY.none;
  const units = state.units.map((u) => (u.id === unitId ? { ...u, ct: carry } : u));
  const active = state.turn.active.filter((a) => a.unitId !== unitId);
  const events: GameEvent[] = [{ type: 'turn-ended', unitId }];
  const next: GameState = { ...state, units, turn: { ...state.turn, active } };
  return active.length ? { state: next, events } : prepend(events, advance(next));
}

/**
 * Drops active units that can no longer act (downed mid-phase, e.g. by
 * friendly fire) and advances if none remain.
 */
export function pruneActive(step: Step): Step {
  const { state } = step;
  if (state.turn.phase === 'over') return step;
  const standing = new Set(state.units.filter(isStanding).map((u) => u.id));
  const active = state.turn.active.filter((a) => standing.has(a.unitId));
  if (active.length === state.turn.active.length) return step;
  const next: GameState = { ...state, turn: { ...state.turn, active } };
  return active.length ? { state: next, events: step.events } : prepend(step.events, advance(next));
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
