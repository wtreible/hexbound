import * as THREE from 'three';
import type { Look } from '../data/looks';
import type { ModelLibrary } from './models';

// Head-and-shoulders portraits of a unit's actual model for the command bar,
// drawn once per look by a small offscreen renderer and cached as data URLs.

const SIZE = 160;

export type Portraits = { get(look: Look, background: number): string | null };

export function createPortraits(library: ModelLibrary | null): Portraits {
  const cache = new Map<string, string>();
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x5a4b38, 2));
  const key = new THREE.DirectionalLight(0xffe8c0, 1.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  // Framed on the head and chest of a model scaled as on the board (about 1.2 units tall).
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.35, 0.98, 1.25);
  camera.lookAt(0, 0.82, 0);

  return {
    get(look, background) {
      if (!library) return null;
      const id = `${JSON.stringify(look)}:${background}`;
      const hit = cache.get(id);
      if (hit) return hit;
      const character = library.create(look);
      if (!character) return null;
      renderer ??= new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, canvas: document.createElement('canvas') });
      renderer.setSize(SIZE, SIZE, false);
      scene.background = new THREE.Color(background);
      character.update(0.4); // settle into the idle pose
      scene.add(character.object);
      renderer.render(scene, camera);
      scene.remove(character.object);
      const url = renderer.domElement.toDataURL('image/png');
      cache.set(id, url);
      return url;
    },
  };
}
