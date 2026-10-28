import * as THREE from 'three';
import { posOf } from '../rules/grid';
import { sideTexture, topTexture } from './textures';
import type { Grid, Hazard, HazardId, Pos, TerrainId } from '../rules/types';

// One height tier is half a tile tall (docs/DESIGN.md §9.1). A height-0 tile still
// has one tier of thickness so the board reads as a chunky diorama.
export const TIER = 0.5;
const TILE_SIZE = 0.96; // the gap shows the background as grid lines
const WATER_TOP = TIER * 0.6;


export type HighlightKind = 'reach' | 'pass' | 'path' | 'range' | 'area' | 'facing' | 'exit' | 'hold' | 'cast';

const HIGHLIGHT_COLORS: Record<HighlightKind, number> = {
  reach: 0x5aa0e0,
  pass: 0x5a7090,
  path: 0xf0c060,
  range: 0xe0905a,
  area: 0xe04a3a,
  facing: 0xf0e0b0,
  exit: 0x5fbf6a,
  hold: 0xe0b84a,
  cast: 0x9a6ad0,
};

// Hazard markers: oil, fire and runes cover the tile; traps and mines are small discs.
const HAZARD_LOOK: Record<HazardId, { color: number; opacity: number; disc: boolean }> = {
  oil: { color: 0x1c1712, opacity: 0.75, disc: false },
  fire: { color: 0xff6a1f, opacity: 0.7, disc: false },
  trap: { color: 0xb8b0a0, opacity: 0.95, disc: true },
  mine: { color: 0xc0392b, opacity: 0.95, disc: true },
  rune: { color: 0x6ab8ff, opacity: 0.55, disc: false },
};

export function tileTop(grid: Grid, p: Pos): number {
  const tile = grid.tiles[p.y * grid.width + p.x];
  if (!tile) return 0;
  return tile.terrain === 'water' ? WATER_TOP : (tile.height + 1) * TIER;
}

/** World-space centre of a tile's top face. */
export function tileCenter(grid: Grid, p: Pos): THREE.Vector3 {
  return new THREE.Vector3(p.x, tileTop(grid, p), p.y);
}

export type BoardView = {
  /** Board centre at ground level, for the camera target. */
  center: THREE.Vector3;
  setHighlights(highlights: Map<number, HighlightKind>): void;
  setCursor(p: Pos | null): void;
  /** Outline the selected unit's tile. */
  setSelection(p: Pos | null): void;
  setHazards(hazards: readonly Hazard[]): void;
  /** Animates water. */
  update(dt: number): void;
  /** Grid index of the tile under the ray, or null. */
  pick(raycaster: THREE.Raycaster): number | null;
};

export function createBoard(parent: THREE.Object3D, grid: Grid): BoardView {
  const group = new THREE.Group();
  parent.add(group);

  // Textured tops and darker banded sides (src/render/textures.ts). Water is a
  // translucent, gently scrolling surface.
  const materials = new Map<TerrainId, THREE.Material[]>();
  const waterTextures: THREE.Texture[] = [];
  const materialsFor = (terrain: TerrainId) => {
    let m = materials.get(terrain);
    if (!m) {
      const map = topTexture(terrain);
      const water = terrain === 'water';
      if (water) waterTextures.push(map);
      const top = new THREE.MeshStandardMaterial({ map, roughness: water ? 0.4 : 0.95, transparent: water, opacity: water ? 0.88 : 1 });
      const side = new THREE.MeshStandardMaterial({ map: sideTexture(terrain), roughness: 1 });
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
      m = [side, side, top, side, side, side];
      materials.set(terrain, m);
    }
    return m;
  };

  const tileMeshes: THREE.Mesh[] = [];
  const overlays: THREE.Mesh[] = [];
  const overlayGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE).rotateX(-Math.PI / 2);
  const overlayMaterial = (kind: HighlightKind) =>
    new THREE.MeshBasicMaterial({ color: HIGHLIGHT_COLORS[kind], transparent: true, opacity: 0.45, depthWrite: false });
  const overlayMaterials: Record<HighlightKind, THREE.Material> = {
    reach: overlayMaterial('reach'),
    pass: overlayMaterial('pass'),
    path: overlayMaterial('path'),
    range: overlayMaterial('range'),
    area: overlayMaterial('area'),
    facing: overlayMaterial('facing'),
    exit: overlayMaterial('exit'),
    hold: overlayMaterial('hold'),
    cast: overlayMaterial('cast'),
  };

  grid.tiles.forEach((tile, i) => {
    const p = posOf(grid, i);
    const top = tileTop(grid, p);
    const geometry = new THREE.BoxGeometry(TILE_SIZE, top, TILE_SIZE);
    // Side faces repeat their texture once per tier instead of stretching it.
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (const face of [0, 1, 4, 5]) for (let v = face * 4; v < face * 4 + 4; v++) uv.setY(v, uv.getY(v) * (top / TIER));
    const mesh = new THREE.Mesh(geometry, materialsFor(tile.terrain));
    mesh.position.set(p.x, top / 2, p.y);
    mesh.userData.index = i;
    group.add(mesh);
    tileMeshes.push(mesh);

    const overlay = new THREE.Mesh(overlayGeometry, overlayMaterials.reach);
    overlay.position.set(p.x, top + 0.01, p.y);
    overlay.visible = false;
    overlay.renderOrder = 1;
    group.add(overlay);
    overlays.push(overlay);
  });

  const h = TILE_SIZE / 2;
  const cursor = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-h, 0, -h),
      new THREE.Vector3(h, 0, -h),
      new THREE.Vector3(h, 0, h),
      new THREE.Vector3(-h, 0, h),
    ]),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  cursor.visible = false;
  cursor.renderOrder = 2;
  group.add(cursor);

  // A solid square frame rather than a line: WebGL lines are always 1px wide.
  const frameShape = new THREE.Shape()
    .moveTo(-h, -h)
    .lineTo(h, -h)
    .lineTo(h, h)
    .lineTo(-h, h)
    .lineTo(-h, -h);
  const inner = h - 0.07;
  frameShape.holes.push(
    new THREE.Path().moveTo(-inner, -inner).lineTo(-inner, inner).lineTo(inner, inner).lineTo(inner, -inner).lineTo(-inner, -inner),
  );
  const selection = new THREE.Mesh(
    new THREE.ShapeGeometry(frameShape).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffd866, depthWrite: false }),
  );
  selection.visible = false;
  selection.renderOrder = 2;
  group.add(selection);

  const hazardGroup = new THREE.Group();
  group.add(hazardGroup);
  const hazardPlane = new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9).rotateX(-Math.PI / 2);
  const hazardDisc = new THREE.CircleGeometry(0.18, 16).rotateX(-Math.PI / 2);
  const hazardMaterials = Object.fromEntries(
    Object.entries(HAZARD_LOOK).map(([id, look]) => [
      id,
      new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: look.opacity, depthWrite: false }),
    ]),
  ) as Record<string, THREE.Material>;

  return {
    center: new THREE.Vector3((grid.width - 1) / 2, 0, (grid.depth - 1) / 2),
    update(dt) {
      for (const t of waterTextures) t.offset.x = (t.offset.x + dt * 0.05) % 1;
    },
    setHazards(hazards) {
      hazardGroup.clear();
      for (const h of hazards) {
        const mesh = new THREE.Mesh(HAZARD_LOOK[h.id].disc ? hazardDisc : hazardPlane, hazardMaterials[h.id]);
        mesh.position.copy(tileCenter(grid, h.pos)).setY(tileTop(grid, h.pos) + 0.005);
        mesh.renderOrder = 0;
        hazardGroup.add(mesh);
      }
    },
    setHighlights(highlights) {
      overlays.forEach((overlay, i) => {
        const kind = highlights.get(i);
        overlay.visible = kind !== undefined;
        if (kind) overlay.material = overlayMaterials[kind];
      });
    },
    setCursor(p) {
      cursor.visible = p !== null;
      if (p) cursor.position.copy(tileCenter(grid, p)).setY(tileTop(grid, p) + 0.02);
    },
    setSelection(p) {
      selection.visible = p !== null;
      if (p) selection.position.copy(tileCenter(grid, p)).setY(tileTop(grid, p) + 0.025);
    },
    pick(raycaster) {
      const hit = raycaster.intersectObjects(tileMeshes, false)[0];
      return hit ? (hit.object.userData.index as number) : null;
    },
  };
}
