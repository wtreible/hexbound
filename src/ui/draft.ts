import { JOBS } from '../data/jobs';
import { UNIT_NAMES } from '../data/units';
import { button, el, screen } from './dom';

// Squad draft (docs/DESIGN.md §5.1). Solo: one player drafts the whole squad.
// The player-slot picker is a hot-seat stand-in until networking (M3), so
// cross-player combos can be tried locally.

export type DraftPick = { name: string; job: string; ownerId: string };

const STARTER_JOBS = ['squire', 'archer', 'acolyte', 'mage'];

export function mountDraft(root: HTMLElement, size: number, onBegin: (picks: DraftPick[]) => void): { dispose(): void } {
  const s = screen(root, 'draft-screen');
  const picks: DraftPick[] = Array.from({ length: size }, (_, i) => ({
    name: UNIT_NAMES[i] ?? `Unit ${i + 1}`,
    job: STARTER_JOBS[i % STARTER_JOBS.length]!,
    ownerId: 'p1',
  }));
  const baseJobs = Object.values(JOBS).filter((j) => j.tier === 1);

  const panel = el('div', 'panel draft-panel');
  panel.append(el('h2', '', 'Draft your company'), el('p', 'hint', `Choose ${size} units. Jobs can be changed later at camp.`));
  const rows = el('div', 'draft-rows');
  picks.forEach((pick, i) => {
    const row = el('div', 'draft-row');
    const name = el('input');
    name.value = pick.name;
    name.maxLength = 16;
    name.addEventListener('input', () => (pick.name = name.value.trim() || `Unit ${i + 1}`));
    const job = el('select');
    for (const j of baseJobs) job.append(new Option(j.name, j.id));
    job.value = pick.job;
    job.addEventListener('change', () => (pick.job = job.value));
    const owner = el('select');
    owner.title = 'Player slot (hot-seat testing until multiplayer)';
    for (const p of ['p1', 'p2']) owner.append(new Option(p, p));
    owner.addEventListener('change', () => (pick.ownerId = owner.value));
    row.append(name, job, owner);
    rows.append(row);
  });
  panel.append(rows, button('Begin run', () => onBegin(picks.map((p) => ({ ...p }))), { className: 'primary' }));
  s.append(panel);
  return { dispose: () => s.remove() };
}
