import { JOBS } from '../data/jobs';
import { UNIT_NAMES } from '../data/units';
import { unlockedRelics, type Profile } from '../rules/profile';
import { button, el, screen } from './dom';

// Squad draft (docs/DESIGN.md §5.1, §6.7). Solo: one player drafts the whole
// squad from the profile's starting jobs and picks a starting relic. The
// player-slot picker is a hot-seat stand-in until networking (M3), so
// cross-player combos can be tried locally.

export type DraftPick = { name: string; job: string; ownerId: string };

export function mountDraft(root: HTMLElement, size: number, profile: Profile, onBegin: (picks: DraftPick[], relic: string) => void): { dispose(): void } {
  const s = screen(root, 'draft-screen');
  const jobs = profile.startingJobs.map((id) => JOBS[id]).filter((j) => j !== undefined);
  const picks: DraftPick[] = Array.from({ length: size }, (_, i) => ({
    name: UNIT_NAMES[i] ?? `Unit ${i + 1}`,
    job: jobs[i % jobs.length]!.id,
    ownerId: 'p1',
  }));
  const relics = unlockedRelics(profile);
  let relic = relics[0]!.id;

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
    for (const j of jobs) job.append(new Option(j.name, j.id));
    job.value = pick.job;
    job.addEventListener('change', () => (pick.job = job.value));
    const owner = el('select');
    owner.title = 'Player slot (hot-seat testing until multiplayer)';
    for (const p of ['p1', 'p2']) owner.append(new Option(p, p));
    owner.addEventListener('change', () => (pick.ownerId = owner.value));
    row.append(name, job, owner);
    rows.append(row);
  });

  const relicRow = el('label', 'draft-relic');
  const relicSelect = el('select');
  for (const r of relics) relicSelect.append(new Option(r.name, r.id));
  const relicText = el('span', 'hint', relics[0]!.description);
  relicSelect.addEventListener('change', () => {
    relic = relicSelect.value;
    relicText.textContent = relics.find((r) => r.id === relic)!.description;
  });
  relicRow.append(el('span', 'field-label', 'Relic'), relicSelect, relicText);

  const more = Object.values(JOBS).filter((j) => j.tier === 1).length - jobs.length;
  const hint = more > 0 ? el('p', 'hint', `Master a job in any run to draft it here (${more} more to find).`) : null;
  panel.append(rows, relicRow, ...(hint ? [hint] : []), button('Begin run', () => onBegin(picks.map((p) => ({ ...p })), relic), { className: 'primary' }));
  s.append(panel);
  return { dispose: () => s.remove() };
}
