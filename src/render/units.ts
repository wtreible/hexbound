import * as THREE from 'three';
import { ENEMY_LOOKS, NPC_LOOK, PLAYER_LOOKS, type Look } from '../data/looks';
import { FACING_STEPS } from '../rules/grid';
import { effectiveStats, jobOf } from '../rules/jobs';
import type { Facing, Grid, Pos, Unit } from '../rules/types';
import { tileCenter } from './board';
import type { Character, ClipKey, ModelLibrary } from './models';

// Units on the board. With the model library loaded they are animated KayKit
// characters (docs/DESIGN.md §9); otherwise placeholder capsules with a facing
// cone. A coloured disc underfoot shows the team, a ring marks units that can
// act, and the selected unit gets a floating job badge.
const STEP_SECONDS = 0.22;
const HOP_HEIGHT = 0.35;

export const OWNER_COLORS: Record<string, number> = {
  p1: 0x4f7fb8,
  p2: 0x5f9a5a,
  p3: 0xc29a3e,
  p4: 0x8a62a8,
  npc: 0xd9c79e,
  enemy: 0xb8574f,
};
const RING_SELECTED = 0xffffff;
const RING_ACTIVE = 0xe0b84a;

export type UnitsView = {
  /** Snap every unit to its state: position, facing, HP bar and pose. */
  sync(units: readonly Unit[]): void;
  /** Walk (or, with turn: false, slide) a unit along a path; resolves on arrival. */
  animateMove(unitId: string, path: Pos[], facing: Facing, opts?: { turn?: boolean }): Promise<void>;
  /** Play a one-off action clip (attack, cast, item...). */
  act(unitId: string, clip: ClipKey): Promise<void>;
  setFacing(unitId: string, facing: Facing): void;
  /** Gold ring under units that can act this phase, white under the selected one. */
  setRings(selected: string | null, active: readonly string[]): void;
  /** Id of the living or downed unit under the ray, or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  /** World position above a unit's head, for floating text. */
  headPosition(unitId: string): THREE.Vector3 | null;
  /** Called for each footstep while walking. */
  onStep: (() => void) | null;
  update(dt: number): void;
};

type Walk = { unitId: string; points: THREE.Vector3[]; t: number; turn: boolean; done: () => void };
type Pose = 'standing' | 'downed' | 'gone';

type UnitMesh = {
  root: THREE.Group;
  figure: THREE.Group;
  character: Character | null;
  /** Capsule fallback material, for greying out when downed. */
  material: THREE.MeshStandardMaterial | null;
  baseColor: THREE.Color;
  ring: THREE.Mesh;
  grave: THREE.Mesh;
  badge: THREE.Sprite;
  bar: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; sprite: THREE.Sprite; drawn: string };
  pose: Pose;
};

function facingAngle(f: Facing): number {
  const d = FACING_STEPS[f]!;
  return Math.atan2(d.x, d.y);
}

export function lookFor(u: Unit): Look {
  if (u.ownerId === 'enemy') return ENEMY_LOOKS[u.job] ?? ENEMY_LOOKS.squire!;
  if (u.ownerId === 'npc') return NPC_LOOK;
  return PLAYER_LOOKS[u.job] ?? PLAYER_LOOKS.squire!;
}

function spriteFromCanvas(canvas: HTMLCanvasElement): { texture: THREE.CanvasTexture; sprite: THREE.Sprite } {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.renderOrder = 3;
  return { texture, sprite };
}

/** A round parchment badge with the job's initial, shown over the selected unit. */
function jobBadge(u: Unit): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e9dcc0';
  ctx.strokeStyle = '#b08d3c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2f22';
  ctx.font = 'bold 34px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(jobOf(u).name[0]!, 32, 35);
  const { sprite } = spriteFromCanvas(canvas);
  sprite.scale.set(0.34, 0.34, 1);
  sprite.position.y = 1.45;
  sprite.visible = false;
  return sprite;
}

export function createUnits(parent: THREE.Object3D, grid: Grid, library: ModelLibrary | null): UnitsView {
  const meshes = new Map<string, UnitMesh>();
  const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.35, 4, 12).translate(0, 0.425, 0);
  const noseGeometry = new THREE.ConeGeometry(0.1, 0.22, 10).rotateX(Math.PI / 2).translate(0, 0.55, 0.3);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xe9dcc0 });
  const pickGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.1, 8).translate(0, 0.55, 0);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const discGeometry = new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  const ringGeometry = new THREE.RingGeometry(0.34, 0.42, 32).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
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
    const character = library?.create(lookFor(u)) ?? null;
    let material: THREE.MeshStandardMaterial | null = null;
    if (character) {
      figure.add(character.object);
    } else {
      material = new THREE.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.7 });
      figure.add(new THREE.Mesh(bodyGeometry, material), new THREE.Mesh(noseGeometry, noseMaterial));
    }
    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.userData.unitId = u.id;
    figure.add(pick);
    pickables.push(pick);

    const disc = new THREE.Mesh(discGeometry, new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.75, depthWrite: false }));
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }));
    ring.visible = false;
    const grave = new THREE.Mesh(graveGeometry, graveMaterial);
    grave.visible = false;

    // HP bar: a camera-facing sprite drawn on a small canvas.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const { texture, sprite } = spriteFromCanvas(canvas);
    sprite.scale.set(0.7, 0.0875, 1);
    sprite.position.y = 1.2;
    const badge = jobBadge(u);

    root.add(disc, figure, ring, grave, sprite, badge);
    parent.add(root);
    const m: UnitMesh = { root, figure, character, material, baseColor, ring, grave, badge, bar: { canvas, texture, sprite, drawn: '' }, pose: 'standing' };
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

  const setPose = (m: UnitMesh, pose: Pose) => {
    if (m.pose === pose) return;
    const was = m.pose;
    m.pose = pose;
    m.figure.visible = pose !== 'gone';
    m.bar.sprite.visible = pose !== 'gone';
    if (m.character) {
      if (pose === 'downed') void m.character.once('die', 'hold');
      else if (pose === 'standing' && was === 'downed') m.character.loop('idle');
    } else {
      // Capsules lie on their back, greyed out.
      m.figure.rotation.x = pose === 'downed' ? -Math.PI / 2 : 0;
      m.figure.position.y = pose === 'downed' ? 0.25 : 0;
      m.material!.color.copy(pose === 'downed' ? downedColor : m.baseColor);
    }
  };

  const view: UnitsView = {
    onStep: null,
    sync(units) {
      for (const u of units) {
        const m = meshFor(u);
        m.root.position.copy(tileCenter(grid, u.pos));
        m.figure.rotation.y = facingAngle(u.facing);
        setPose(m, u.dead || u.escaped ? 'gone' : u.downedRounds !== undefined ? 'downed' : 'standing');
        m.grave.visible = !!u.dead;
        if (!u.dead && !u.escaped) drawBar(m, u.hp, effectiveStats(u).hp);
      }
    },
    animateMove(unitId, path, facing, opts = {}) {
      const m = meshes.get(unitId);
      if (!m || path.length < 2) return Promise.resolve();
      if (opts.turn ?? true) m.character?.loop('walk');
      return new Promise((resolve) => {
        walk = {
          unitId,
          points: path.map((p) => tileCenter(grid, p)),
          t: 0,
          turn: opts.turn ?? true,
          done: () => {
            m.figure.rotation.y = facingAngle(facing);
            if (m.pose === 'standing') m.character?.loop('idle');
            resolve();
          },
        };
      });
    },
    act(unitId, clip) {
      const m = meshes.get(unitId);
      return m?.character && m.pose === 'standing' ? m.character.once(clip) : Promise.resolve();
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
        m.badge.visible = id === sel;
      }
    },
    pick(raycaster) {
      const visible = pickables.filter((o) => o.parent?.visible);
      const hit = raycaster.intersectObjects(visible, false)[0];
      return hit ? (hit.object.userData.unitId as string) : null;
    },
    headPosition(unitId) {
      const m = meshes.get(unitId);
      return m ? m.root.position.clone().setY(m.root.position.y + 1.3) : null;
    },
    update(dt) {
      bob += dt;
      if (walk) {
        const m = meshes.get(walk.unitId)!;
        const before = Math.floor(walk.t);
        walk.t += dt / STEP_SECONDS;
        if (Math.floor(walk.t) !== before) view.onStep?.();
        const seg = Math.min(Math.floor(walk.t), walk.points.length - 2);
        const k = Math.min(1, walk.t - seg);
        const a = walk.points[seg]!;
        const b = walk.points[seg + 1]!;
        m.root.position.lerpVectors(a, b, k);
        // Hop over height changes, small bounce on flat ground.
        const hop = a.y === b.y ? 0.04 : HOP_HEIGHT + Math.abs(b.y - a.y) * 0.3;
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
        m.character?.update(dt);
        // Capsules bob when selected; models already breathe in their idle clip.
        if (!m.character) m.figure.children[0]!.position.y = id === selected && m.pose === 'standing' ? 0.04 + Math.sin(bob * 5) * 0.04 : 0;
        if (m.badge.visible) m.badge.position.y = 1.45 + Math.sin(bob * 3) * 0.03;
      }
    },
  };
  return view;
}
