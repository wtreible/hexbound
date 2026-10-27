import { JOBS } from '../data/jobs';
import {
  availableJobs,
  grantJp,
  job,
  passiveOptions,
  rankOf,
  secondaryOptions,
  setLoadout,
  ultimateOptions,
  type Loadout,
} from '../rules/jobs';
import type { Unit } from '../rules/types';
import { OWNER_COLORS } from '../render/units';
import { rankLine } from './actionMenu';

// Camp between battles (M4 test harness; the full Camp node arrives with the
// run in M5). Change each unit's job, secondary, passive and ultimate, and
// grant debug JP to test progression quickly.

export const DEBUG_JP = 100;

export type CampView = { dispose(): void };

export type CampOptions = {
  squad: Unit[];
  battlesWon: number;
  /** Shown at the top, e.g. after the squad was wiped out. */
  notice?: string;
  onChange(squad: Unit[]): void;
  onStart(): void;
};

const el = (tag: string, className: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

const cssColor = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

export function mountCamp(appRoot: HTMLElement, opts: CampOptions): CampView {
  let squad = opts.squad;
  const root = el('div', 'camp');
  appRoot.appendChild(root);

  const update = (i: number, next: Unit) => {
    squad = squad.map((u, j) => (j === i ? next : u));
    opts.onChange(squad);
    render();
  };

  const select = (label: string, value: string, options: { id: string; name: string }[], none: boolean, onPick: (id: string) => void) => {
    const wrap = el('label', 'field');
    wrap.append(el('span', 'field-label', label));
    const s = document.createElement('select');
    if (none) s.append(new Option('None', ''));
    for (const o of options) s.append(new Option(o.name, o.id));
    s.value = value;
    s.disabled = options.length === 0 && none;
    s.addEventListener('change', () => onPick(s.value));
    wrap.append(s);
    return wrap;
  };

  const card = (u: Unit, i: number) => {
    const c = el('div', 'panel camp-card');
    c.style.borderTop = `4px solid ${cssColor(OWNER_COLORS[u.ownerId] ?? 0x999999)}`;
    c.append(el('div', 'name', `${u.name} · ${u.ownerId}`), el('div', 'job', `${job(u.job).name} · ${rankLine(u, u.job)}`));

    const error = el('div', 'error');
    const apply = (patch: Partial<Loadout>) => {
      const loadout: Loadout = { job: u.job, secondary: u.secondary, passive: u.passive, ultimate: u.ultimate, ...patch };
      // A job can't be its own secondary: switching into it clears the slot.
      if (loadout.secondary === loadout.job) loadout.secondary = undefined;
      for (const k of ['secondary', 'passive', 'ultimate'] as const) if (!loadout[k]) delete loadout[k];
      const r = setLoadout(u, loadout);
      if ('error' in r) error.textContent = r.error;
      else update(i, r);
    };

    const jobs = availableJobs(u).map((j) => ({ id: j.id, name: j.tier > 1 ? `★ ${j.name}` : j.name }));
    c.append(
      select('Job', u.job, jobs, false, (id) => apply({ job: id })),
      select('Secondary', u.secondary ?? '', secondaryOptions(u).map((j) => ({ id: j.id, name: j.name })), true, (id) => apply({ secondary: id || undefined })),
      select('Passive', u.passive ?? '', passiveOptions(u).map((a) => ({ id: a.id, name: a.name })), true, (id) => apply({ passive: id || undefined })),
      select('Ultimate', u.ultimate ?? '', ultimateOptions(u).map((a) => ({ id: a.id, name: a.name })), true, (id) => apply({ ultimate: id || undefined })),
    );

    // JP in every job the unit has touched.
    const jp = el('div', 'jp-list');
    for (const j of Object.values(JOBS)) {
      const amount = u.jp[j.id];
      if (amount === undefined) continue;
      const rank = rankOf(u, j.id);
      jp.append(el('span', rank >= 3 ? 'jp mastered' : 'jp', `${j.name} ${rank >= 3 ? '★' : `R${rank}`} ${amount}`));
    }
    c.append(jp);

    const debug = document.createElement('button');
    debug.className = 'debug';
    debug.textContent = `+${DEBUG_JP} JP (debug)`;
    debug.addEventListener('click', () => update(i, grantJp(u, DEBUG_JP).unit));
    c.append(debug, error);
    return c;
  };

  const render = () => {
    const header = el('div', 'panel camp-header');
    header.append(el('h2', '', 'Camp'), el('div', 'job', `Battles won: ${opts.battlesWon}`));
    if (opts.notice) header.append(el('div', 'notice', opts.notice));
    const start = document.createElement('button');
    start.className = 'start';
    start.textContent = 'Start battle';
    start.addEventListener('click', () => opts.onStart());
    header.append(start);
    const cards = el('div', 'camp-cards');
    squad.forEach((u, i) => cards.append(card(u, i)));
    root.replaceChildren(header, cards);
  };

  render();
  return { dispose: () => root.remove() };
}
