import { facingOfStep, indexOf, inBounds, pathTo, reachable } from './grid';
import type { Rng } from './rng';
import type { GameEvent, GameState, Intent, Unit } from './types';

export type IntentResult = { state: GameState; events: GameEvent[] } | { error: string };

// The single entry point for changing game state (DESIGN.md §8). The host
// runs this for every intent, including in solo play. Returns a new state;
// the input is never mutated.
export function applyIntent(state: GameState, intent: Intent, _rng: Rng): IntentResult {
  const unit = state.units.find((u) => u.id === intent.unitId);
  if (!unit) return { error: `no unit ${intent.unitId}` };

  switch (intent.type) {
    case 'move': {
      if (!inBounds(state.grid, intent.to)) return { error: 'destination out of bounds' };
      const reach = reachable(state.grid, state.units, unit);
      const node = reach.get(indexOf(state.grid, intent.to));
      if (!node || !node.canStop) return { error: 'destination not reachable' };
      const path = pathTo(state.grid, reach, intent.to);
      if (path.length < 2) return { error: 'already there' };
      const facing = facingOfStep(path[path.length - 2]!, intent.to);
      return {
        state: updateUnit(state, { ...unit, pos: intent.to, facing }),
        events: [{ type: 'moved', unitId: unit.id, path }],
      };
    }
    case 'face':
      return {
        state: updateUnit(state, { ...unit, facing: intent.facing }),
        events: [{ type: 'faced', unitId: unit.id, facing: intent.facing }],
      };
  }
}

function updateUnit(state: GameState, unit: Unit): GameState {
  return { ...state, units: state.units.map((u) => (u.id === unit.id ? unit : u)) };
}
