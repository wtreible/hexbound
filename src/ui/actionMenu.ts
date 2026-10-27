import { itemAbilities } from '../rules/items';
import { abilityEntries, canAfford, effectiveStats, job, jobOf, RANK_JP, rankOf, type AbilitySource } from '../rules/jobs';
import type { ActiveUnit, Unit } from '../rules/types';
import type { Portraits } from '../render/portraits';
import { lookFor, OWNER_COLORS } from '../render/units';
import { STATUS_NAMES } from './names';

// Bottom-centre command bar for the selected active unit: avatar on the left,
// numbered actions in the middle, stats on the right. Actions the unit can't
// take right now (already moved or acted, locked by rank, too expensive) are
// greyed out. Keys 1-9, then 0, - and = pick actions by position.

export const ACTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export type ActionKey = 'move' | 'wait' | { abilityId: string };

export type Action = {
  key: ActionKey;
  label: string;
  detail: string;
  disabled: boolean;
  section: 'move' | AbilitySource | 'item' | 'wait';
};

/** The unit's actions in menu order: Move, basic attack, primary set, secondary set, ultimate, items, Wait. */
export function listActions(unit: Unit, entry: ActiveUnit, inventory: Record<string, number> = {}): Action[] {
  return [
    { key: 'move', label: 'Move', detail: '', disabled: entry.moved, section: 'move' },
    ...abilityEntries(unit).map((e): Action => {
      const mp = e.ability.cost?.mp ?? 0;
      const detail = e.locked ? `Rank ${e.rank}` : e.ability.cost?.resolve ? 'Resolve' : mp ? `${mp} MP` : '';
      return {
        key: { abilityId: e.ability.id },
        label: e.ability.name,
        detail,
        disabled: e.locked || entry.acted || !canAfford(unit, e.ability),
        section: e.source,
      };
    }),
    ...itemAbilities(inventory).map((i): Action => ({
      key: { abilityId: i.ability.id },
      label: i.ability.name,
      detail: `×${i.count}`,
      disabled: entry.acted,
      section: 'item',
    })),
    { key: 'wait', label: 'Wait', detail: '', disabled: false, section: 'wait' },
  ];
}

export function sameAction(a: ActionKey, b: ActionKey | null): boolean {
  if (b === null) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.abilityId === b.abilityId;
}

export type ActionMenuView = {
  show(unit: Unit, entry: ActiveUnit, picked: ActionKey | null, inventory: Record<string, number>): void;
  hide(): void;
};

const cssColor = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** The unit's model portrait on its team colour, or its job initial if models aren't loaded. */
export function portraitElement(unit: Unit, portraits: Portraits | null): HTMLElement {
  const color = OWNER_COLORS[unit.ownerId] ?? 0x999999;
  const box = el('div', 'portrait');
  box.style.background = cssColor(color);
  const url = portraits?.get(lookFor(unit), color);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = jobOf(unit).name;
    box.append(img);
  } else {
    box.textContent = jobOf(unit).name[0]!;
  }
  return box;
}

const el = (tag: string, className: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** "Rank 1 · 75/150 JP", or "Mastered". */
export function rankLine(unit: Unit, jobId: string): string {
  const rank = rankOf(unit, jobId);
  const jp = unit.jp[jobId] ?? 0;
  const next = RANK_JP[rank];
  return next === undefined ? `Mastered · ${jp} JP` : `Rank ${rank} · ${jp}/${next} JP`;
}

export function mountActionMenu(root: HTMLElement, onAction: (key: ActionKey) => void, portraits: Portraits | null = null): ActionMenuView {
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
    show(unit, entry, picked, inventory) {
      const stats = effectiveStats(unit);
      const j = jobOf(unit);

      const avatar = el('div', 'panel avatar');
      const portrait = portraitElement(unit, portraits);
      avatar.append(portrait, el('div', 'name', unit.name), el('div', 'job', `${j.name} · Lv ${unit.level}`), el('div', 'job', rankLine(unit, j.id)));

      const sectionTitle: Partial<Record<Action['section'], string>> = {
        primary: j.name,
        secondary: unit.secondary ? job(unit.secondary).name : '',
        ultimate: 'Ultimate',
        item: 'Items',
      };
      const actions = el('div', 'panel actions');
      let lastSection: Action['section'] | null = null;
      listActions(unit, entry, inventory).forEach((action, i) => {
        const title = sectionTitle[action.section];
        if (title && action.section !== lastSection) actions.appendChild(el('div', 'section', title));
        lastSection = action.section;
        const b = document.createElement('button');
        b.disabled = action.disabled;
        if (sameAction(action.key, picked)) b.classList.add('picked');
        b.append(el('span', 'num', ACTION_KEYS[i] ?? ''), el('span', 'label', action.label), el('span', 'detail', action.detail));
        b.addEventListener('click', () => onAction(action.key));
        actions.appendChild(b);
      });

      const info = el('div', 'panel stats');
      info.append(meter('HP', unit.hp, stats.hp, 'hp'), meter('MP', unit.mp, stats.mp, 'mp'), meter('RES', unit.resolve, 100, 'resolve'));
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
