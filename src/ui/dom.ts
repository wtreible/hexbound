// Small DOM helpers shared by the menu screens.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(label: string, onClick: () => void, opts: { className?: string; disabled?: boolean } = {}): HTMLButtonElement {
  const b = el('button', opts.className ?? '', label);
  b.disabled = !!opts.disabled;
  b.addEventListener('click', onClick);
  return b;
}

export const cssColor = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** A full-screen menu layer; remove() disposes it. */
export function screen(root: HTMLElement, className: string): HTMLDivElement {
  const s = el('div', `screen ${className}`);
  root.appendChild(s);
  return s;
}
