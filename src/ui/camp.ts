import { JOBS } from '../data/jobs';
import { canEquip, GEAR_SLOTS, item } from '../rules/items';
import { availableJobs, effectiveStats, job, passiveOptions, rankOf, secondaryOptions, ultimateOptions, type Loadout } from '../rules/jobs';
import { changeLoadout, debugJp, equip, rest, type RunState } from '../rules/run';
import type { Unit } from '../rules/types';
import { OWNER_COLORS } from '../render/units';
import type { Portraits } from '../render/portraits';
import { portraitElement, rankLine } from './actionMenu';
import { button, cssColor, el, screen } from './dom';

// Camp node (docs/DESIGN.md §5.1): change each unit's job, secondary, passive,
// ultimate and gear, and rest once to heal half of everyone's max HP. A debug
// JP button appears in dev builds or with ?debug, for testing progression.

export const DEBUG_JP = 100;
const SHOW_DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' } as const;

export function mountCamp(
  root: HTMLElement,
  initial: RunState,
  opts: { onChange(run: RunState): void; onLeave(run: RunState): void; portraits?: Portraits | null },
) {
  let run = initial;
  const s = screen(root, 'camp');

  const apply = (r: RunState | { error: string }, errorEl: HTMLElement) => {
    if ('error' in r) {
      errorEl.textContent = r.error;
      return;
    }
    run = r;
    opts.onChange(run);
    render();
  };

  const select = (label: string, value: string, options: { id: string; name: string }[], none: boolean, onPick: (id: string) => void) => {
    const wrap = el('label', 'field');
    wrap.append(el('span', 'field-label', label));
    const sel = el('select');
    if (none) sel.append(new Option('None', ''));
    for (const o of options) sel.append(new Option(o.name, o.id));
    sel.value = value;
    sel.disabled = options.length === 0 && none && !value;
    sel.addEventListener('change', () => onPick(sel.value));
    wrap.append(sel);
    return wrap;
  };

  const card = (u: Unit) => {
    const c = el('div', 'panel camp-card');
    c.style.borderTop = `4px solid ${cssColor(OWNER_COLORS[u.ownerId] ?? 0x999999)}`;
    const head = el('div', 'camp-head');
    const titles = el('div');
    titles.append(el('div', 'name', `${u.name} · ${u.ownerId}`), el('div', 'job', `${job(u.job).name} · ${rankLine(u, u.job)}`));
    head.append(portraitElement(u, opts.portraits ?? null), titles);
    c.append(head);
    const error = el('div', 'error');

    const loadout = (patch: Partial<Loadout>) => {
      const next: Loadout = { job: u.job, secondary: u.secondary, passive: u.passive, ultimate: u.ultimate, ...patch };
      // A job can't be its own secondary: switching into it clears the slot.
      if (next.secondary === next.job) next.secondary = undefined;
      for (const k of ['secondary', 'passive', 'ultimate'] as const) if (!next[k]) delete next[k];
      apply(changeLoadout(run, u.id, next), error);
    };

    const jobs = availableJobs(u).map((j) => ({ id: j.id, name: j.tier > 1 ? `★ ${j.name}` : j.name }));
    c.append(
      select('Job', u.job, jobs, false, (id) => loadout({ job: id })),
      select('Secondary', u.secondary ?? '', secondaryOptions(u).map((j) => ({ id: j.id, name: j.name })), true, (id) => loadout({ secondary: id || undefined })),
      select('Passive', u.passive ?? '', passiveOptions(u).map((a) => ({ id: a.id, name: a.name })), true, (id) => loadout({ passive: id || undefined })),
      select('Ultimate', u.ultimate ?? '', ultimateOptions(u).map((a) => ({ id: a.id, name: a.name })), true, (id) => loadout({ ultimate: id || undefined })),
    );

    // Gear: what's equipped plus anything in the stash this unit can use.
    for (const slot of GEAR_SLOTS) {
      const current = u.gear?.[slot];
      const options = [...new Set(run.stash)].filter((id) => canEquip(u, id, slot)).map((id) => ({ id, name: `${item(id).name} (${item(id).description})` }));
      if (current) options.unshift({ id: current, name: `${item(current).name} (${item(current).description})` });
      c.append(select(SLOT_NAMES[slot], current ?? '', options, true, (id) => apply(equip(run, u.id, slot, id || null), error)));
    }

    // JP in every job the unit has touched.
    const jp = el('div', 'jp-list');
    for (const j of Object.values(JOBS)) {
      const amount = u.jp[j.id];
      if (amount === undefined) continue;
      const rank = rankOf(u, j.id);
      jp.append(el('span', rank >= 3 ? 'jp mastered' : 'jp', `${j.name} ${rank >= 3 ? '★' : `R${rank}`} ${amount}`));
    }
    c.append(jp, el('div', 'job', `HP ${u.hp}/${effectiveStats(u).hp} · Lv ${u.level}`));
    if (SHOW_DEBUG) c.append(button(`+${DEBUG_JP} JP (debug)`, () => apply(debugJp(run, u.id, DEBUG_JP), error), { className: 'debug' }));
    c.append(error);
    return c;
  };

  const render = () => {
    const header = el('div', 'panel camp-header');
    header.append(
      el('h2', '', 'Camp'),
      el('div', 'job', `Change jobs and gear, or rest to heal half of everyone's HP. Gold ${run.gold} · Stash ${run.stash.length}`),
      button(run.camp?.rested ? 'Rested' : 'Rest', () => apply(rest(run), header), { className: 'start', disabled: !!run.camp?.rested }),
      button('Leave camp', () => opts.onLeave(run), { className: 'start' }),
    );
    const cards = el('div', 'camp-cards');
    for (const u of run.squad) cards.append(card(u));
    s.replaceChildren(header, cards);
  };

  render();
  return { dispose: () => s.remove() };
}
