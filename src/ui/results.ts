import { jobOf } from '../rules/jobs';
import { JOBS } from '../data/jobs';
import type { RunState } from '../rules/run';
import { button, el, screen } from './dom';

export function mountResults(root: HTMLElement, run: RunState, unlocks: string[], onNew: () => void): { dispose(): void } {
  const s = screen(root, 'results-screen');
  const panel = el('div', 'panel results-panel');
  panel.append(
    el('h2', '', run.status === 'won' ? 'The Hexbinder falls' : 'The company is lost'),
    el('p', '', `${run.battlesWon} battles won · ${run.visited.length} stops on the road`),
  );
  if (run.squad.length) {
    panel.append(el('h3', '', 'Survivors'));
    for (const u of run.squad) panel.append(el('div', '', `${u.name} · ${jobOf(u).name} · Lv ${u.level}`));
  }
  if (run.fallen.length) {
    panel.append(el('h3', '', 'Fallen'));
    for (const f of run.fallen) panel.append(el('div', '', `${f.name} · ${JOBS[f.job]?.name ?? f.job} · Lv ${f.level}`));
  }
  if (unlocks.length) {
    panel.append(el('h3', '', 'Unlocked'));
    for (const line of unlocks) panel.append(el('div', 'unlock', line));
  }
  panel.append(button('New run', onNew, { className: 'primary' }));
  s.append(panel);
  return { dispose: () => s.remove() };
}
