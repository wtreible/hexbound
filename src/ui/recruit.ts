import { effectiveStats, jobOf } from '../rules/jobs';
import type { RunState } from '../rules/run';
import type { Portraits } from '../render/portraits';
import { portraitElement } from './actionMenu';
import { button, el, screen } from './dom';

export function mountRecruit(
  root: HTMLElement,
  run: RunState,
  opts: { onRecruit(id: string): void; onLeave(): void; portraits?: Portraits | null },
): { dispose(): void } {
  const s = screen(root, 'recruit-screen');
  const full = run.squad.length >= run.squadSize;
  const panel = el('div', 'panel recruit-panel');
  panel.append(
    el('h2', '', 'Recruits'),
    el('p', 'hint', full ? 'The company is full: lose someone first to make room.' : 'One may join the company.'),
  );
  const cards = el('div', 'recruit-cards');
  for (const u of run.recruits ?? []) {
    const st = effectiveStats(u);
    const card = el('div', 'panel recruit-card');
    card.append(
      portraitElement(u, opts.portraits ?? null),
      el('div', 'name', u.name),
      el('div', 'job', `${jobOf(u).name} · Lv ${u.level}`),
      el('div', 'hint', `HP ${st.hp} · MP ${st.mp} · ATK ${st.atk} · MAG ${st.mag} · SPD ${st.spd}`),
      button('Recruit', () => opts.onRecruit(u.id), { disabled: full, className: 'primary' }),
    );
    cards.append(card);
  }
  panel.append(cards, button('Leave', opts.onLeave));
  s.append(panel);
  return { dispose: () => s.remove() };
}
