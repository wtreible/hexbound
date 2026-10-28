import { JOBS } from '../data/jobs';
import { canEquip, GEAR_SLOTS, item } from '../rules/items';
import { ability, availableJobs, effectiveStats, isMastered, job, jobLevel, knows, missingRequirements, secondaryOptions, slotOptions, type Loadout } from '../rules/jobs';
import { changeLoadout, debugJp, equip, learnAbility, rest, type RunState } from '../rules/run';
import type { Unit } from '../rules/types';
import { OWNER_COLORS } from '../render/units';
import type { Portraits } from '../render/portraits';
import { jobLine, portraitElement } from './actionMenu';
import { button, cssColor, el, screen } from './dom';

// Camp node (docs/DESIGN.md §5.1, §6; decision 0023): change each unit's job,
// secondary, ability slots and gear, spend JP to learn abilities, and rest once
// to heal half of everyone's max HP. A debug JP button appears in dev builds or
// with ?debug, for testing progression.

export const DEBUG_JP = 100;
const SHOW_DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' } as const;
const ABILITY_SLOTS = [
  ['reaction', 'Reaction'],
  ['support', 'Support'],
  ['movement', 'Movement'],
  ['ultimate', 'Ultimate'],
] as const;
const KIND_NAMES = { action: 'Action', reaction: 'Reaction', support: 'Support', movement: 'Movement', ultimate: 'Ultimate', combo: 'Combo' } as const;

export function mountCamp(
  root: HTMLElement,
  initial: RunState,
  opts: { onChange(run: RunState): void; onLeave(run: RunState): void; portraits?: Portraits | null },
) {
  let run = initial;
  const s = screen(root, 'camp');
  /** The job each unit's learn list is showing (defaults to its current job). */
  const studying = new Map<string, string>();

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
    titles.append(el('div', 'name', `${u.name} · ${u.ownerId}`), el('div', 'job', `${job(u.job).name} · ${jobLine(u, u.job)}`));
    head.append(portraitElement(u, opts.portraits ?? null), titles);
    c.append(head);
    const error = el('div', 'error');

    const loadout = (patch: Partial<Loadout>) => {
      const next: Loadout = { job: u.job, secondary: u.secondary, reaction: u.reaction, support: u.support, movement: u.movement, ultimate: u.ultimate, ...patch };
      // A job can't be its own secondary: switching into it clears the slot.
      if (next.secondary === next.job) next.secondary = undefined;
      for (const k of ['secondary', 'reaction', 'support', 'movement', 'ultimate'] as const) if (!next[k]) delete next[k];
      apply(changeLoadout(run, u.id, next), error);
    };

    const jobs = availableJobs(u).map((j) => ({ id: j.id, name: j.tier > 1 ? `★ ${j.name}` : j.name }));
    c.append(
      select('Job', u.job, jobs, false, (id) => loadout({ job: id })),
      select('Secondary', u.secondary ?? '', secondaryOptions(u).map((j) => ({ id: j.id, name: j.name })), true, (id) => loadout({ secondary: id || undefined })),
      ...ABILITY_SLOTS.map(([slot, label]) =>
        select(label, u[slot] ?? '', slotOptions(u, slot).map((a) => ({ id: a.id, name: a.name })), true, (id) => loadout({ [slot]: id || undefined })),
      ),
    );

    // Gear: what's equipped plus anything in the stash this unit can use.
    for (const slot of GEAR_SLOTS) {
      const current = u.gear?.[slot];
      const options = [...new Set(run.stash)].filter((id) => canEquip(u, id, slot)).map((id) => ({ id, name: `${item(id).name} (${item(id).description})` }));
      if (current) options.unshift({ id: current, name: `${item(current).name} (${item(current).description})` });
      c.append(select(SLOT_NAMES[slot], current ?? '', options, true, (id) => apply(equip(run, u.id, slot, id || null), error)));
    }

    c.append(learnPanel(u, error));
    c.append(el('div', 'job', `HP ${u.hp}/${effectiveStats(u).hp} · Lv ${u.level}`));
    if (SHOW_DEBUG) c.append(button(`+${DEBUG_JP} JP (debug)`, () => apply(debugJp(run, u.id, DEBUG_JP), error), { className: 'debug' }));
    c.append(error);
    return c;
  };

  /** One job's abilities with JP prices and Learn buttons, a job picker, and what the locked jobs need. */
  const learnPanel = (u: Unit, error: HTMLElement) => {
    const panel = el('div', 'learn');
    const unlocked = availableJobs(u);
    const current = studying.get(u.id) ?? u.job;
    const shown = unlocked.some((j) => j.id === current) ? current : u.job;
    const label = (id: string) => `${job(id).name} · Lv ${jobLevel(u, id)} · ${u.jp[id] ?? 0} JP${isMastered(u, id) ? ' ★' : ''}`;
    panel.append(
      select('Learn', shown, unlocked.map((j) => ({ id: j.id, name: label(j.id) })), false, (id) => {
        studying.set(u.id, id);
        render();
      }),
    );
    const list = el('div', 'learn-list');
    const jp = u.jp[shown] ?? 0;
    for (const { abilityId, jp: price } of job(shown).abilities) {
      const a = ability(abilityId);
      const row = el('div', knows(u, abilityId) ? 'learn-row known' : 'learn-row');
      row.title = a.description;
      row.append(el('span', 'kind', KIND_NAMES[a.kind]), el('span', 'label', a.name));
      if (knows(u, abilityId)) row.append(el('span', 'detail', 'Learned'));
      else row.append(button(`${price} JP`, () => apply(learnAbility(run, u.id, shown, abilityId), error), { className: 'learn-buy', disabled: jp < price }));
      list.append(row);
    }
    panel.append(list);
    const locked = Object.values(JOBS).filter((j) => j.tier > 0 && !unlocked.includes(j));
    if (locked.length) {
      const next = el('details', 'locked-jobs');
      next.append(el('summary', '', `Locked jobs (${locked.length})`));
      for (const j of locked) next.append(el('div', 'locked-job', `${j.name}: ${missingRequirements(u, j.id)}`));
      panel.append(next);
    }
    return panel;
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
