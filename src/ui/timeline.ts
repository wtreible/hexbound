import { predictOrder } from '../rules/turn';
import type { GameState } from '../rules/types';
import { findUnit, isEnemy } from '../rules/units';

// Turn order panel: who is acting now, then the predicted next turns.
const SHOWN = 8;

export type TimelineView = { update(state: GameState): void };

export function mountTimeline(root: HTMLElement): TimelineView {
  const el = document.createElement('div');
  el.className = 'panel timeline';
  root.appendChild(el);
  return {
    update(state) {
      const active = new Set(state.turn.phase === 'over' ? [] : state.turn.active.map((a) => a.unitId));
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = 'Turn order';
      const items = predictOrder(state, SHOWN).map((id, i) => {
        const u = findUnit(state.units, id)!;
        const row = document.createElement('div');
        row.className = `entry ${isEnemy(u) ? 'enemy' : 'player'}${i < active.size && active.has(id) ? ' now' : ''}`;
        row.textContent = u.name;
        return row;
      });
      el.replaceChildren(title, ...items);
    },
  };
}
