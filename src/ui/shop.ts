import { item } from '../rules/items';
import { buy, SHOP_CONSUMABLES, type RunState } from '../rules/run';
import { button, el, screen } from './dom';

// Shop node: gear for this act (one of each) and consumables (unlimited).
// Bought gear goes to the stash; equip it at a camp.

export function mountShop(root: HTMLElement, initial: RunState, opts: { onChange(run: RunState): void; onLeave(run: RunState): void }) {
  let run = initial;
  const s = screen(root, 'shop-screen');

  const render = () => {
    const panel = el('div', 'panel shop-panel');
    const error = el('div', 'error');
    panel.append(el('h2', '', 'Shop'), el('p', 'hint', `Gold ${run.gold}. Gear goes to the stash: equip it at a camp.`));
    const row = (id: string, owned: string) => {
      const i = item(id);
      const r = el('div', 'shop-row');
      r.append(
        el('span', 'name', i.name),
        el('span', 'hint', `${i.description}${i.tag ? ` · ${i.tag}` : ''}`),
        el('span', 'hint', owned),
        button(`${i.price} g`, () => {
          const next = buy(run, id);
          if ('error' in next) error.textContent = next.error;
          else {
            run = next;
            opts.onChange(run);
            render();
          }
        }, { disabled: run.gold < i.price }),
      );
      return r;
    };
    panel.append(el('h3', '', 'Supplies'));
    for (const id of SHOP_CONSUMABLES) panel.append(row(id, `have ${run.inventory[id] ?? 0}`));
    panel.append(el('h3', '', 'Gear'));
    if (!run.shop?.gear.length) panel.append(el('div', 'hint', 'Sold out.'));
    for (const id of run.shop?.gear ?? []) panel.append(row(id, ''));
    panel.append(error, button('Leave', () => opts.onLeave(run)));
    s.replaceChildren(panel);
  };

  render();
  return { dispose: () => s.remove() };
}
