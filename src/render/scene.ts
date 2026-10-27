import * as THREE from 'three';

// Orthographic camera at ~30° elevation (DESIGN.md §9.1). VIEW_SIZE is the
// number of world units visible vertically at zoom 1.
const VIEW_SIZE = 8;
const ELEVATION = THREE.MathUtils.degToRad(30);
const AZIMUTH = THREE.MathUtils.degToRad(45);
const DISTANCE = 20;

export type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  /** Called each frame with seconds since the previous frame. */
  onFrame: ((dt: number) => void) | null;
};

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2620);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(
    DISTANCE * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    DISTANCE * Math.sin(ELEVATION),
    DISTANCE * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x4a3b2a, 1.2));
  const sun = new THREE.DirectionalLight(0xffe8c0, 1.5);
  sun.position.set(5, 10, 3);
  scene.add(sun);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    camera.left = (-VIEW_SIZE * aspect) / 2;
    camera.right = (VIEW_SIZE * aspect) / 2;
    camera.top = VIEW_SIZE / 2;
    camera.bottom = -VIEW_SIZE / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', resize);
  resize();

  const handle: SceneHandle = { scene, camera, renderer, onFrame: null };
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    handle.onFrame?.(timer.getDelta());
    renderer.render(scene, camera);
  });
  return handle;
}
