import type { NodeType } from '../rules/run';

// Run map icons as SVG path data on a 20x20 grid, drawn as strokes. Drawn
// for this game (no asset licence needed) so they look the same everywhere,
// unlike emoji.
export const NODE_ICONS: Record<NodeType, string> = {
  // Crossed swords
  battle: 'M4 4 L16 16 M16 4 L4 16 M3 13 L7 17 M13 17 L17 13',
  // Skull
  elite: 'M10 3 A6 6 0 0 1 16 9 V12 H14 V15 H6 V12 H4 V9 A6 6 0 0 1 10 3 Z M7 9 H9 M11 9 H13 M9 15 V13 M11 15 V13',
  // Tent with an open flap
  camp: 'M3 17 L10 4 L17 17 Z M10 4 V17 M8 17 L10 13 L12 17',
  // A figure with a plus
  recruit: 'M9 5 A2.5 2.5 0 1 1 8.99 5 Z M4 17 A5 5 0 0 1 14 17 M16 5 V11 M13 8 H19',
  // Coin purse
  shop: 'M7 5 H13 L12 7 A6 6 0 1 1 8 7 Z M10 10 V15 M8.5 11.5 H11.5',
  // Star
  shrine: 'M10 2 L12 8 L18 8 L13 12 L15 18 L10 14 L5 18 L7 12 L2 8 L8 8 Z',
  // Crown
  boss: 'M3 15 L4 6 L8 10 L10 4 L12 10 L16 6 L17 15 Z M3 17 H17',
};

const SVG = 'http://www.w3.org/2000/svg';

/** A standalone icon element, e.g. for legends. */
export function iconSvg(type: NodeType, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', NODE_ICONS[type]);
  svg.append(path);
  return svg;
}
