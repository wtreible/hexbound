import type { RunState } from '../rules/run';
import { button, el, screen } from './dom';

export function mountTitle(root: HTMLElement, saved: RunState | null, opts: { onContinue(): void; onNew(): void; onCodex(): void }): { dispose(): void } {
  const s = screen(root, 'title-screen');
  const panel = el('div', 'panel title-panel');
  panel.append(el('h1', '', 'Hexbound Company'), el('p', 'tagline', 'A co-op tactics roguelike'));
  if (saved) {
    const act = saved.at ? saved.at.split('-')[0] : '1';
    panel.append(
      button('Continue run', opts.onContinue, { className: 'primary' }),
      el('div', 'hint', `Act ${act} · ${saved.visited.length} stops · ${saved.squad.length} in the squad`),
    );
  }
  panel.append(button('New run', opts.onNew, { className: saved ? '' : 'primary' }));
  if (saved) panel.append(el('div', 'hint', 'Starting a new run abandons the saved one.'));
  panel.append(button('Codex', opts.onCodex));
  s.append(panel);
  return { dispose: () => s.remove() };
}
