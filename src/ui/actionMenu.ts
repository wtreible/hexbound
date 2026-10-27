import { abilitiesOf, effectiveStats, jobOf } from '../rules/jobs';
import type { ActiveUnit, Unit } from '../rules/types';
import { OWNER_COLORS } from '../render/units';

// Bottom-centre command bar for the selected active unit: avatar on the left,
// numbered actions in the middle (keys 1-9), stats on the right. Actions the
// unit can't take right now are greyed out.

export type ActionKey = 'move' | 'wait' | { abilityId: string };

export type Action = { key: ActionKey; label: string; detail: string; disabled: boolean };

/** The unit's actions in menu order: Move, basic attack, job abilities, Wait. */
export function listActions(unit: Unit, entry: ActiveUnit): Action[] {
  return [
    { key: 'move', label: 'Move', detail: '', disabled: entry.moved },
    ...abilitiesOf(unit).map((a) => {
      const cost = a.cost?.mp ?? 0;
      return { key: { abilityId: a.id }, label: a.name, detail: cost ? `${cost} MP` : '', disabled: entry.acted || cost > unit.mp };
    }),
    { key: 'wait', label: 'Wait', detail: '', disabled: false },
  ];
}

export function sameAction(a: ActionKey, b: ActionKey | null): boolean {
  if (b === null) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.abilityId === b.abilityId;
}

export type ActionMenuView = {
  show(unit: Unit, entry: ActiveUnit, picked: ActionKey | null): void;
  hide(): void;
};

export const STATUS_NAMES = { guard: 'Guard', pinned: 'Pinned' } as const;

const cssColor = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

const el = (tag: string, className: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function mountActionMenu(root: HTMLElement, onAction: (key: ActionKey) => void): ActionMenuView {
  const bar = el('div', 'command-bar');
  bar.hidden = true;
  root.appendChild(bar);

  const meter = (label: string, value: number, max: number, cls: string) => {
    const row = el('div', 'meter');
    const fill = el('div', `fill ${cls}`);
    fill.style.width = `${max > 0 ? Math.round((value / max) * 100) : 0}%`;
    const track = el('div', 'track');
    track.appendChild(fill);
    row.append(el('span', 'label', label), track, el('span', 'value', `${value}/${max}`));
    return row;
  };

  return {
    show(unit, entry, picked) {
      const stats = effectiveStats(unit);
      const job = jobOf(unit);

      // Placeholder portrait until character art lands in M6.
      const avatar = el('div', 'panel avatar');
      const portrait = el('div', 'portrait', job.name[0]);
      portrait.style.background = cssColor(OWNER_COLORS[unit.ownerId] ?? 0x999999);
      avatar.append(portrait, el('div', 'name', unit.name), el('div', 'job', `${job.name} · Lv ${unit.level}`));

      const actions = el('div', 'panel actions');
      listActions(unit, entry).forEach((action, i) => {
        const b = document.createElement('button');
        b.disabled = action.disabled;
        if (sameAction(action.key, picked)) b.classList.add('picked');
        b.append(el('span', 'num', String(i + 1)), el('span', 'label', action.label), el('span', 'detail', action.detail));
        b.addEventListener('click', () => onAction(action.key));
        actions.appendChild(b);
      });

      const info = el('div', 'panel stats');
      info.append(meter('HP', unit.hp, stats.hp, 'hp'), meter('MP', unit.mp, stats.mp, 'mp'));
      const grid = el('div', 'stat-grid');
      const shown: [string, number | string][] = [
        ['ATK', stats.atk], ['MAG', stats.mag], ['DEF', stats.def], ['RES', stats.res],
        ['SPD', stats.spd], ['EVA', `${stats.evade}%`], ['MOVE', stats.move], ['JUMP', stats.jump],
      ];
      for (const [k, v] of shown) grid.append(el('span', 'k', k), el('span', 'v', String(v)));
      info.append(grid, el('div', 'ct', `CT ${unit.ct}`));
      if (unit.statuses.length) info.append(el('div', 'statuses', unit.statuses.map((s) => STATUS_NAMES[s.id]).join(', ')));

      bar.replaceChildren(avatar, actions, info);
      bar.hidden = false;
    },
    hide() {
      bar.hidden = true;
    },
  };
}
