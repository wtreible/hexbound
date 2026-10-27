import * as THREE from 'three';
import { indexOf, pathTo, posOf, reachable, tileAt, type Reach } from '../rules/grid';
import { applyIntent } from '../rules/reducer';
import type { Rng } from '../rules/rng';
import type { GameState, Intent, Unit } from '../rules/types';
import { createBoard, type HighlightKind } from '../render/board';
import type { SceneHandle } from '../render/scene';
import { createUnits } from '../render/units';

// M1 hot-seat board: click a unit to see its reach, hover to preview a path,
// click a highlighted tile to move. Q/E rotate, wheel or Z/X zoom, Esc cancels.
// Every change goes through applyIntent so M3 can route it through the host.

type Mode =
  | { kind: 'idle' }
  | { kind: 'selected'; unitId: string; reach: Reach }
  | { kind: 'animating' };

export function mountBattle(view: SceneHandle, uiRoot: HTMLElement, initial: GameState, rng: Rng): void {
  let state = initial;
  let mode: Mode = { kind: 'idle' };
  let hovered: number | null = null;

  const { grid } = state;
  const board = createBoard(view.scene, grid);
  const units = createUnits(view.scene, grid);
  units.sync(state.units);
  view.lookAt(board.center);

  const hud = document.createElement('div');
  hud.className = 'panel hud';
  uiRoot.appendChild(hud);

  const unitAt = (i: number): Unit | undefined => state.units.find((u) => indexOf(grid, u.pos) === i);

  const refresh = () => {
    const highlights = new Map<number, HighlightKind>();
    const m = mode;
    if (m.kind === 'selected') {
      for (const [i, node] of m.reach) highlights.set(i, node.canStop ? 'reach' : 'pass');
      const target = hovered !== null ? m.reach.get(hovered) : undefined;
      if (target?.canStop) {
        for (const p of pathTo(grid, m.reach, target.pos)) highlights.set(indexOf(grid, p), 'path');
      }
      const unit = state.units.find((u) => u.id === m.unitId);
      if (unit) highlights.set(indexOf(grid, unit.pos), 'selected');
    }
    board.setHighlights(highlights);
    board.setCursor(hovered !== null ? posOf(grid, hovered) : null);
    units.setSelected(mode.kind === 'selected' ? mode.unitId : null);
    renderHud();
  };

  const renderHud = () => {
    const lines: string[] = [];
    if (hovered !== null) {
      const p = posOf(grid, hovered);
      const tile = tileAt(grid, p)!;
      const occupant = unitAt(hovered);
      lines.push(`Tile ${p.x},${p.y} · ${tile.terrain} · height ${tile.height}`);
      if (occupant) lines.push(`${occupant.name} (${occupant.ownerId}) · move ${occupant.base.move} · jump ${occupant.base.jump}`);
    }
    const m = mode;
    if (m.kind === 'selected') {
      const u = state.units.find((x) => x.id === m.unitId)!;
      lines.push(`Selected: ${u.name} · move ${u.base.move} · jump ${u.base.jump}`);
    }
    lines.push('Click unit to select · Q/E rotate · wheel or Z/X zoom · Esc cancel');
    hud.replaceChildren(
      ...lines.map((text, i) => {
        const div = document.createElement('div');
        div.textContent = text;
        if (i === lines.length - 1) div.className = 'hint';
        return div;
      }),
    );
  };

  const select = (unit: Unit) => {
    mode = { kind: 'selected', unitId: unit.id, reach: reachable(grid, state.units, unit) };
    refresh();
  };

  const dispatch = async (intent: Intent) => {
    const result = applyIntent(state, intent, rng);
    if ('error' in result) {
      console.warn(`[battle] rejected ${intent.type}: ${result.error}`);
      return;
    }
    state = result.state;
    mode = { kind: 'animating' };
    refresh();
    for (const event of result.events) {
      if (event.type === 'moved') {
        const unit = state.units.find((u) => u.id === event.unitId)!;
        await units.animateMove(event.unitId, event.path, unit.facing);
      }
    }
    units.sync(state.units);
    mode = { kind: 'idle' };
    refresh();
  };

  const onClick = (i: number | null) => {
    if (mode.kind === 'animating') return;
    if (i === null) {
      mode = { kind: 'idle' };
      refresh();
      return;
    }
    const occupant = unitAt(i);
    if (mode.kind === 'selected') {
      const node = mode.reach.get(i);
      if (node?.canStop && occupant?.id !== mode.unitId) {
        void dispatch({ type: 'move', unitId: mode.unitId, to: node.pos });
        return;
      }
    }
    if (occupant) select(occupant);
    else {
      mode = { kind: 'idle' };
      refresh();
    }
  };

  // Picking: a unit's body wins over the tile behind it, so tall units on
  // low tiles stay clickable from every camera angle.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickAt = (e: PointerEvent | MouseEvent): number | null => {
    const rect = view.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, view.camera);
    const unitId = units.pick(raycaster);
    const unit = unitId ? state.units.find((u) => u.id === unitId) : undefined;
    return unit ? indexOf(grid, unit.pos) : board.pick(raycaster);
  };

  // Re-pick every frame from the last pointer position so the cursor and path
  // preview follow the board while the camera rotates or zooms under a still mouse.
  let pointer: PointerEvent | null = null;
  view.onFrame = (dt) => {
    units.update(dt);
    const i = pointer ? pickAt(pointer) : null;
    if (i !== hovered) {
      hovered = i;
      refresh();
    }
  };

  const canvas = view.renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    pointer = e;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
  });
  canvas.addEventListener('click', (e) => onClick(pickAt(e)));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key.toLowerCase()) {
      case 'q':
        view.rotate(-1);
        break;
      case 'e':
        view.rotate(1);
        break;
      case 'z':
        view.zoom(1);
        break;
      case 'x':
        view.zoom(-1);
        break;
      case 'escape':
        if (mode.kind === 'selected') {
          mode = { kind: 'idle' };
          refresh();
        }
        break;
    }
  });

  refresh();
}
