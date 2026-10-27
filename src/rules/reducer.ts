import { resolveAbility } from './abilities';
import { inRange } from './combat';
import { facingOfStep, indexOf, inBounds, pathTo, reachable } from './grid';
import { abilitiesOf, effectiveStats } from './jobs';
import type { Rng } from './rng';
import { checkVictory, endTurn, pruneActive, type Step } from './turn';
import type { ActiveUnit, GameState, Intent } from './types';
import { findUnit } from './units';

export type IntentResult = Step | { error: string };

// The single entry point for changing game state (DESIGN.md §8). The host
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
      const path = pathTo(state.grid, reach, intent.to);
      if (path.length < 2) return { error: 'already there' };
      const facing = facingOfStep(path[path.length - 2]!, intent.to);
      const units = state.units.map((u) => (u.id === unit.id ? { ...u, pos: intent.to, facing } : u));
      return { state: { ...state, units, turn: mark({ moved: true }) }, events: [{ type: 'moved', unitId: unit.id, path }] };
    }
    case 'act': {
      if (entry.acted) return { error: 'already acted' };
      const ability = abilitiesOf(unit).find((a) => a.id === intent.abilityId);
      if (!ability) return { error: `${unit.name} can't use ${intent.abilityId}` };
      if ((ability.cost?.mp ?? 0) > unit.mp) return { error: 'not enough MP' };
      if (!inRange(state.grid, ability, unit.pos, intent.target)) return { error: 'target out of range' };
      const r = resolveAbility(state.grid, state.units, unit.id, ability, intent.target, rng);
      const next: GameState = { ...state, units: r.units, turn: mark({ acted: true }) };
      return pruneActive(checkVictory({ state: next, events: r.events }));
    }
    case 'face': {
      const units = state.units.map((u) => (u.id === unit.id ? { ...u, facing: intent.facing } : u));
      return { state: { ...state, units }, events: [{ type: 'faced', unitId: unit.id, facing: intent.facing }] };
    }
    case 'wait':
      return endTurn(state, unit.id);
  }
}
