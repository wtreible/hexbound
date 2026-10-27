import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Look } from '../data/looks';

// Character models (docs/DESIGN.md §9.2, §9.3). Loads public/models/manifest.json
// and every model it lists once, then builds characters from a Look: a
// skeleton-aware clone with its props shown or hidden, weapons attached to
// the hand bones, a tint, and an animation controller.

/** Clip names kept by scripts/build-models.mjs. */
export const CLIPS = {
  idle: 'Idle',
  walk: 'Walking_A',
  hit: 'Hit_A',
  die: 'Death_A',
  downed: 'Death_A_Pose',
  cheer: 'Cheer',
  item: 'Use_Item',
  melee: '1H_Melee_Attack_Chop',
  shoot: '1H_Ranged_Shoot',
  cast: 'Spellcast_Shoot',
  support: 'Spellcast_Raise',
} as const;

export type ClipKey = keyof typeof CLIPS;

type Manifest = {
  scale: number;
  bones: { right: string; left: string };
  bodies: Record<string, string>;
  weapons: Record<string, string>;
};

export type Character = {
  object: THREE.Object3D;
  /** Loop a clip (idle, walk, downed) until told otherwise. */
  loop(clip: ClipKey): void;
  /** Play a clip once, then return to `then` (default idle). Resolves when it ends. */
  once(clip: ClipKey, then?: ClipKey | 'hold'): Promise<void>;
  update(dt: number): void;
};

export type ModelLibrary = { create(look: Look): Character | null };

const FADE = 0.15;

export async function loadModels(base: string): Promise<ModelLibrary> {
  const root = `${base}models/`;
  const manifest = (await (await fetch(`${root}manifest.json`)).json()) as Manifest;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (file: string) => loader.loadAsync(root + file);

  const bodies = new Map<string, GLTF>();
  const weapons = new Map<string, THREE.Object3D>();
  await Promise.all([
    ...Object.entries(manifest.bodies).map(async ([key, file]) => bodies.set(key, await load(file))),
    ...Object.entries(manifest.weapons).map(async ([key, file]) => weapons.set(key, (await load(file)).scene)),
  ]);

  return {
    create(look) {
      const gltf = bodies.get(look.body);
      if (!gltf) return null;
      const model = cloneSkinned(gltf.scene);
      model.scale.setScalar(manifest.scale);

      const tint = look.tint !== undefined ? new THREE.Color(look.tint) : null;
      model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        // Rigid meshes are the body's props (weapons, hats, capes): show only the look's.
        if (!(o instanceof THREE.SkinnedMesh)) o.visible = look.props.includes(o.name);
        if (tint) {
          o.material = (o.material as THREE.MeshStandardMaterial).clone();
          (o.material as THREE.MeshStandardMaterial).color.multiply(tint);
        }
      });
      for (const [hand, key] of Object.entries(look.attach ?? {})) {
        const bone = model.getObjectByName(manifest.bones[hand as 'right' | 'left']);
        const weapon = key ? weapons.get(key) : undefined;
        if (bone && weapon) bone.add(weapon.clone());
      }

      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map<ClipKey, THREE.AnimationAction>();
      for (const [key, name] of Object.entries(CLIPS) as [ClipKey, string][]) {
        const clip = gltf.animations.find((a) => a.name === name);
        if (clip) actions.set(key, mixer.clipAction(clip));
      }
      let current: THREE.AnimationAction | null = null;
      const fadeTo = (key: ClipKey, loop: boolean) => {
        const next = actions.get(key);
        if (!next || next === current) return next;
        next.reset();
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        next.clampWhenFinished = !loop;
        next.play();
        if (current) current.crossFadeTo(next, FADE, false);
        current = next;
        return next;
      };

      const character: Character = {
        object: model,
        loop(clip) {
          fadeTo(clip, true);
        },
        once(clip, then = 'idle') {
          const action = fadeTo(clip, false);
          if (!action) return Promise.resolve();
          return new Promise((resolve) => {
            const done = (e: { action: THREE.AnimationAction }) => {
              if (e.action !== action) return;
              mixer.removeEventListener('finished', done);
              if (then !== 'hold' && current === action) fadeTo(then, true);
              resolve();
            };
            mixer.addEventListener('finished', done);
          });
        },
        update(dt) {
          mixer.update(dt);
        },
      };
      character.loop('idle');
      return character;
    },
  };
}
