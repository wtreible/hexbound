import * as THREE from 'three';
import { FACING_STEPS } from '../rules/grid';
import { effectiveStats } from '../rules/jobs';
import type { Facing, Grid, Pos, Unit } from '../rules/types';
import { tileCenter } from './board';

// Placeholder capsule units (DESIGN.md §9.3) so rendering never blocks on
// assets. A cone on the front shows facing. Swapped for glb models in M6.
const STEP_SECONDS = 0.16;
const HOP_HEIGHT = 0.35;

export const OWNER_COLORS: Record<string, number> = {
  p1: 0x4f7fb8,
  p2: 0x5f9a5a,
  p3: 0xc29a3e,
  p4: 0x8a62a8,
  enemy: 0xb8574f,
};
const RING_SELECTED = 0xffffff;
const RING_ACTIVE = 0xe0b84a;

export type UnitsView = {
  /** Snap every unit to its state: position, facing, HP bar and pose. */
  sync(units: readonly Unit[]): void;
  /** Walk (or, with turn: false, slide) a unit along a path; resolves on arrival. */
  animateMove(unitId: string, path: Pos[], facing: Facing, opts?: { turn?: boolean }): Promise<void>;
  setFacing(unitId: string, facing: Facing): void;
  /** Gold ring under units that can act this phase, white under the selected one. */
  setRings(selected: string | null, active: readonly string[]): void;
  /** Id of the living or downed unit under the ray, or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  /** World position above a unit's head, for floating text. */
  headPosition(unitId: string): THREE.Vector3 | null;
  update(dt: number): void;
};

type Walk = { unitId: string; points: THREE.Vector3[]; t: number; turn: boolean; done: () => void };

type UnitMesh = {
  root: THREE.Group;
  figure: THREE.Group;
  material: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  ring: THREE.Mesh;
  grave: THREE.Mesh;
  bar: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; sprite: THREE.Sprite; drawn: string };
};

function facingAngle(f: Facing): number {
  const d = FACING_STEPS[f]!;
  return Math.atan2(d.x, d.y);
}

export function createUnits(scene: THREE.Scene, grid: Grid): UnitsView {
  const meshes = new Map<string, UnitMesh>();
  const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.35, 4, 12).translate(0, 0.425, 0);
  const noseGeometry = new THREE.ConeGeometry(0.1, 0.22, 10).rotateX(Math.PI / 2).translate(0, 0.55, 0.3);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xe9dcc0 });
  const ringGeometry = new THREE.RingGeometry(0.32, 0.4, 24).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
  const graveGeometry = new THREE.BoxGeometry(0.3, 0.42, 0.12).translate(0, 0.21, 0);
  const graveMaterial = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 });
  const downedColor = new THREE.Color(0x6b655c);
  const pickables: THREE.Object3D[] = [];
  let walk: Walk | null = null;
  let selected: string | null = null;
  let bob = 0;

  const meshFor = (u: Unit): UnitMesh => {
    const existing = meshes.get(u.id);
    if (existing) return existing;
    const root = new THREE.Group();
    const figure = new THREE.Group();
    const baseColor = new THREE.Color(OWNER_COLORS[u.ownerId] ?? 0x999999);
    const material = new THREE.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeometry, material);
    body.userData.unitId = u.id;
    figure.add(body, new THREE.Mesh(noseGeometry, noseMaterial));

    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }));
    ring.visible = false;
    const grave = new THREE.Mesh(graveGeometry, graveMaterial);
    grave.visible = false;

    // HP bar: a camera-facing sprite drawn on a small canvas.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(0.7, 0.0875, 1);
    sprite.position.y = 1.15;
    sprite.renderOrder = 3;

    root.add(figure, ring, grave, sprite);
    scene.add(root);
    pickables.push(body);
    const m: UnitMesh = { root, figure, material, baseColor, ring, grave, bar: { canvas, texture, sprite, drawn: '' } };
    meshes.set(u.id, m);
    return m;
  };

  const drawBar = (m: UnitMesh, hp: number, max: number) => {
    const key = `${hp}/${max}`;
    if (m.bar.drawn === key) return;
    m.bar.drawn = key;
    const ctx = m.bar.canvas.getContext('2d')!;
    const ratio = max > 0 ? hp / max : 0;
    ctx.fillStyle = '#1d1913';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = ratio > 0.5 ? '#7fb35a' : ratio > 0.25 ? '#d6a83c' : '#c4523f';
    ctx.fillRect(1, 1, Math.round(62 * ratio), 6);
    m.bar.texture.needsUpdate = true;
  };

  return {
    sync(units) {
      for (const u of units) {
        const m = meshFor(u);
        m.root.position.copy(tileCenter(grid, u.pos));
        m.figure.rotation.y = facingAngle(u.facing);
        const downed = u.downedTurns !== undefined;
        m.figure.visible = !u.dead;
        m.grave.visible = !!u.dead;
        m.bar.sprite.visible = !u.dead;
        // Downed units lie on their back, greyed out.
        m.figure.rotation.x = downed ? -Math.PI / 2 : 0;
        m.figure.position.y = downed ? 0.25 : 0;
        m.material.color.copy(downed ? downedColor : m.baseColor);
        if (!u.dead) drawBar(m, u.hp, effectiveStats(u).hp);
      }
    },
    animateMove(unitId, path, facing, opts = {}) {
      const m = meshes.get(unitId);
      if (!m || path.length < 2) return Promise.resolve();
      return new Promise((resolve) => {
        walk = {
          unitId,
          points: path.map((p) => tileCenter(grid, p)),
          t: 0,
          turn: opts.turn ?? true,
          done: () => {
            m.figure.rotation.y = facingAngle(facing);
            resolve();
          },
        };
      });
    },
    setFacing(unitId, facing) {
      const m = meshes.get(unitId);
      if (m) m.figure.rotation.y = facingAngle(facing);
    },
    setRings(sel, active) {
      selected = sel;
      const activeSet = new Set(active);
      for (const [id, m] of meshes) {
        const material = m.ring.material as THREE.MeshBasicMaterial;
        m.ring.visible = id === sel || activeSet.has(id);
        material.color.setHex(id === sel ? RING_SELECTED : RING_ACTIVE);
      }
    },
    pick(raycaster) {
      const visible = pickables.filter((o) => o.parent?.visible);
      const hit = raycaster.intersectObjects(visible, false)[0];
      return hit ? (hit.object.userData.unitId as string) : null;
    },
    headPosition(unitId) {
      const m = meshes.get(unitId);
      return m ? m.root.position.clone().setY(m.root.position.y + 1.25) : null;
    },
    update(dt) {
      bob += dt;
      if (walk) {
        const m = meshes.get(walk.unitId)!;
        walk.t += dt / STEP_SECONDS;
        const seg = Math.min(Math.floor(walk.t), walk.points.length - 2);
        const k = Math.min(1, walk.t - seg);
        const a = walk.points[seg]!;
        const b = walk.points[seg + 1]!;
        m.root.position.lerpVectors(a, b, k);
        // Hop over height changes, small bounce on flat ground.
        const hop = a.y === b.y ? 0.06 : HOP_HEIGHT + Math.abs(b.y - a.y) * 0.3;
        m.root.position.y += Math.sin(Math.PI * k) * hop;
        if (walk.turn) m.figure.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        if (walk.t >= walk.points.length - 1) {
          m.root.position.copy(walk.points[walk.points.length - 1]!);
          const done = walk.done;
          walk = null;
          done();
        }
      }
      for (const [id, m] of meshes) {
        const body = m.figure.children[0]!;
        body.position.y = id === selected && m.figure.rotation.x === 0 ? 0.04 + Math.sin(bob * 5) * 0.04 : 0;
      }
    },
  };
}
