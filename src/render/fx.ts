import type * as THREE from 'three';

// Floating combat text (docs/DESIGN.md §9.1): white numbers with a dark outline
// that pop up over a unit and fade. DOM overlay positioned from the 3D point.

export type FxKind = 'damage' | 'heal' | 'miss' | 'info';
const LIFETIME_MS = 1100;

export type FxView = {
  popup(world: THREE.Vector3, text: string, kind: FxKind): void;
};

export function createFx(container: HTMLElement, camera: THREE.Camera, canvas: HTMLCanvasElement): FxView {
  return {
    popup(world, text, kind) {
      const p = world.clone().project(camera);
      const rect = canvas.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = `fx-pop fx-${kind}`;
      el.textContent = text;
      el.style.left = `${rect.left + ((p.x + 1) / 2) * rect.width}px`;
      el.style.top = `${rect.top + ((1 - p.y) / 2) * rect.height}px`;
      container.appendChild(el);
      setTimeout(() => el.remove(), LIFETIME_MS);
    },
  };
}
