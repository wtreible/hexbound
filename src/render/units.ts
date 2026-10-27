import * as THREE from 'three';
import { FACING_STEPS } from '../rules/grid';
import type { Facing, Grid, Pos, Unit } from '../rules/types';
import { tileCenter } from './board';

// Placeholder capsule units (DESIGN.md §9.3) so rendering never blocks on
// assets. A cone on the front shows facing. Swapped for glb models in M6.
const STEP_SECONDS = 0.16;
const HOP_HEIGHT = 0.35;

const OWNER_COLORS: Record<string, number> = {
  p1: 0x4f7fb8,
  p2: 0xb8574f,
  p3: 0x5f9a5a,
  p4: 0xc29a3e,
};

export type UnitsView = {
  /** Snap every unit mesh to its state position and facing. */
  sync(units: readonly Unit[]): void;
  /** Walk a unit along a path; resolves when it arrives. */
  animateMove(unitId: string, path: Pos[], facing: Facing): Promise<void>;
  setSelected(unitId: string | null): void;
  /** Id of the unit under the ray, or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  update(dt: number): void;
};

type Walk = { unitId: string; points: THREE.Vector3[]; t: number; done: () => void };

function facingAngle(f: Facing): number {
  const d = FACING_STEPS[f]!;
  return Math.atan2(d.x, d.y);
}

export function createUnits(scene: THREE.Scene, grid: Grid): UnitsView {
  const meshes = new Map<string, THREE.Group>();
  const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.35, 4, 12).translate(0, 0.425, 0);
  const noseGeometry = new THREE.ConeGeometry(0.1, 0.22, 10).rotateX(Math.PI / 2).translate(0, 0.55, 0.3);
  const ringGeometry = new THREE.RingGeometry(0.32, 0.4, 24).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const pickables: THREE.Object3D[] = [];
  let walk: Walk | null = null;
  let selected: string | null = null;
  let bob = 0;

  const meshFor = (u: Unit) => {
    let g = meshes.get(u.id);
    if (!g) {
      g = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: OWNER_COLORS[u.ownerId] ?? 0x999999, roughness: 0.7 });
      const body = new THREE.Mesh(bodyGeometry, material);
      body.userData.unitId = u.id;
      const nose = new THREE.Mesh(noseGeometry, new THREE.MeshStandardMaterial({ color: 0xe9dcc0 }));
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.name = 'ring';
      ring.visible = false;
      g.add(body, nose, ring);
      scene.add(g);
      meshes.set(u.id, g);
      pickables.push(body);
    }
    return g;
  };

  return {
    sync(units) {
      for (const u of units) {
        const g = meshFor(u);
        g.position.copy(tileCenter(grid, u.pos));
        g.rotation.y = facingAngle(u.facing);
      }
    },
    animateMove(unitId, path, facing) {
      const g = meshes.get(unitId);
      if (!g || path.length < 2) return Promise.resolve();
      return new Promise((resolve) => {
        walk = {
          unitId,
          points: path.map((p) => tileCenter(grid, p)),
          t: 0,
          done: () => {
            g.rotation.y = facingAngle(facing);
            resolve();
          },
        };
      });
    },
    setSelected(unitId) {
      selected = unitId;
      for (const [id, g] of meshes) g.getObjectByName('ring')!.visible = id === unitId;
    },
    pick(raycaster) {
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return hit ? (hit.object.userData.unitId as string) : null;
    },
    update(dt) {
      bob += dt;
      if (walk) {
        const g = meshes.get(walk.unitId)!;
        walk.t += dt / STEP_SECONDS;
        const seg = Math.min(Math.floor(walk.t), walk.points.length - 2);
        const k = Math.min(1, walk.t - seg);
        const a = walk.points[seg]!;
        const b = walk.points[seg + 1]!;
        g.position.lerpVectors(a, b, k);
        // Hop over height changes, small bounce on flat ground.
        const hop = a.y === b.y ? 0.06 : HOP_HEIGHT + Math.abs(b.y - a.y) * 0.3;
        g.position.y += Math.sin(Math.PI * k) * hop;
        g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        if (walk.t >= walk.points.length - 1) {
          g.position.copy(walk.points[walk.points.length - 1]!);
          const done = walk.done;
          walk = null;
          done();
        }
      }
      if (selected) {
        const g = meshes.get(selected);
        const body = g?.children[0];
        if (body) body.position.y = 0.04 + Math.sin(bob * 5) * 0.04;
      }
      for (const [id, g] of meshes) if (id !== selected) g.children[0]!.position.y = 0;
    },
  };
}
