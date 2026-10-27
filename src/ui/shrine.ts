import { canChoose, chooseShrine, shrineEvent, type RunState } from '../rules/run';
import { button, el, screen } from './dom';

export function mountShrine(root: HTMLElement, run: RunState, opts: { onChoose(run: RunState): void; onLeave(): void }) {
  const s = screen(root, 'shrine-screen');
  const e = shrineEvent(run);
  const panel = el('div', 'panel shrine-panel');
  panel.append(el('h2', '', e.title), el('p', '', e.text));
  if (run.shrine?.result) {
    panel.append(el('p', 'result', run.shrine.result), button('Continue', opts.onLeave, { className: 'primary' }));
  } else {
    e.choices.forEach((c, i) =>
      panel.append(
        button(c.label, () => {
          const next = chooseShrine(run, i);
          if (!('error' in next)) opts.onChoose(next);
        }, { disabled: !canChoose(run, c) }),
      ),
    );
  }
  s.append(panel);
  return { dispose: () => s.remove() };
}
