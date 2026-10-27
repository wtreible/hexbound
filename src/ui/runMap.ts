import { item } from '../rules/items';
import { effectiveStats, jobOf } from '../rules/jobs';
import { ACTS, CHOICE_ROWS, choices, goldReward, node, type NodeType, type RunState } from '../rules/run';
import { button, el, screen } from './dom';
import { iconSvg, NODE_ICONS } from './icons';

// The run map: acts left to right, each a few rows of choices ending in a
// boss. Click a highlighted node to travel there.

export const NODE_LOOK: Record<NodeType, { name: string }> = {
  battle: { name: 'Battle' },
  elite: { name: 'Elite' },
  camp: { name: 'Camp' },
  recruit: { name: 'Recruit' },
  shop: { name: 'Shop' },
  shrine: { name: 'Shrine' },
  boss: { name: 'Boss' },
};

const COL_W = 74;
const ROW_H = 78;
const PAD = 40;
const SVG = 'http://www.w3.org/2000/svg';

export function mountRunMap(root: HTMLElement, run: RunState, opts: { onEnter(id: string): void; onAbandon(): void }): { dispose(): void } {
  const s = screen(root, 'map-screen');
  const columns = ACTS * (CHOICE_ROWS + 1);
  const width = PAD * 2 + (columns - 1) * COL_W;
  const height = PAD * 2 + 2 * ROW_H;
  const pos = (id: string) => {
    const n = node(run, id);
    const col = (n.act - 1) * (CHOICE_ROWS + 1) + n.row;
    const count = run.nodes.filter((x) => x.act === n.act && x.row === n.row).length;
    return { x: PAD + col * COL_W, y: PAD + ROW_H * (1 + n.col - (count - 1) / 2) };
  };
  const open = new Set(choices(run).map((n) => n.id));
  const visited = new Set(run.visited);

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.classList.add('run-map');
  for (const n of run.nodes) {
    for (const next of n.next) {
      const a = pos(n.id);
      const b = pos(next);
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.classList.add('edge');
      if (visited.has(n.id) && visited.has(next)) line.classList.add('travelled');
      svg.append(line);
    }
  }
  for (const n of run.nodes) {
    const { x, y } = pos(n.id);
    const g = document.createElementNS(SVG, 'g');
    g.classList.add('node', n.type);
    if (visited.has(n.id)) g.classList.add('visited');
    if (n.id === run.at) g.classList.add('here');
    if (open.has(n.id)) {
      g.classList.add('open');
      g.addEventListener('click', () => opts.onEnter(n.id));
    }
    const circle = document.createElementNS(SVG, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', n.type === 'boss' ? '24' : '18');
    const icon = document.createElementNS(SVG, 'path');
    icon.setAttribute('d', NODE_ICONS[n.type]);
    const s = n.type === 'boss' ? 1.4 : 1.1;
    icon.setAttribute('transform', `translate(${x - 10 * s} ${y - 10 * s}) scale(${s})`);
    icon.classList.add('icon');
    const title = document.createElementNS(SVG, 'title');
    const reward = goldReward(n);
    title.textContent = `Act ${n.act} · ${NODE_LOOK[n.type].name}${reward ? ` · ${reward} gold` : ''}`;
    g.append(circle, icon, title);
    svg.append(g);
  }
  for (let act = 1; act <= ACTS; act++) {
    const label = document.createElementNS(SVG, 'text');
    label.setAttribute('x', String(PAD + ((act - 1) * (CHOICE_ROWS + 1) + CHOICE_ROWS / 2) * COL_W));
    label.setAttribute('y', '18');
    label.classList.add('act-label');
    label.textContent = `Act ${act}`;
    svg.append(label);
  }

  const mapPanel = el('div', 'panel map-panel');
  mapPanel.append(el('h2', '', 'The road'), svg);
  const legend = el('div', 'legend');
  for (const [type, look] of Object.entries(NODE_LOOK) as [NodeType, (typeof NODE_LOOK)[NodeType]][]) {
    const item = el('span', 'legend-item');
    item.append(iconSvg(type), document.createTextNode(look.name));
    legend.append(item);
  }
  mapPanel.append(legend);

  const squad = el('div', 'panel squad-panel');
  squad.append(el('h3', '', `Company · ${run.battlesWon} battles won`));
  const supplies = Object.entries(run.inventory)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${item(id).name} ×${n}`)
    .join(', ');
  squad.append(el('div', 'hint', `Gold ${run.gold} · ${supplies || 'no supplies'} · ${run.stash.length} gear in stash`));
  for (const u of run.squad) {
    const max = effectiveStats(u).hp;
    const row = el('div', 'squad-row');
    const bar = el('div', 'track');
    const fill = el('div', 'fill hp');
    fill.style.width = `${Math.round((u.hp / max) * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'name', `${u.name} · ${jobOf(u).name} · Lv ${u.level}`), bar, el('span', 'value', `${u.hp}/${max}`));
    squad.append(row);
  }
  if (run.fallen.length) squad.append(el('div', 'hint', `Fallen: ${run.fallen.map((f) => f.name).join(', ')}`));
  squad.append(button('Abandon run', opts.onAbandon, { className: 'subtle' }));

  s.append(mapPanel, squad);
  return { dispose: () => s.remove() };
}
