import * as THREE from 'three';

// Orthographic camera at ~30° elevation, rotating in 90° steps with a 250ms
// tween and three zoom steps (docs/DESIGN.md §9.1). VIEW_SIZE is the number of
// world units visible vertically at zoom 1.
const VIEW_SIZE = 14;
const ELEVATION = THREE.MathUtils.degToRad(30);
const DISTANCE = 40;
const TWEEN_MS = 250;
const ZOOM_STEPS = [1, 1.6, 2.4];

export type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  /** Called each frame with seconds since the previous frame. */
  onFrame: ((dt: number) => void) | null;
  /** Rotate the view 90° left (-1) or right (+1). */
  rotate(dir: -1 | 1): void;
  /** Step the zoom in (+1) or out (-1), clamped to the zoom steps. */
  zoom(dir: -1 | 1): void;
  /** Jump the camera to look at a point. */
  lookAt(target: THREE.Vector3): void;
  /** Pan smoothly to look at a point. */
  focus(target: THREE.Vector3): void;
  /** Slowly circle the target (radians per second); 0 stops and settles back to the 90° steps. */
  orbit(rate: number): void;
};

type Tween = { from: number; to: number; start: number };

function tweenValue(t: Tween, now: number): number {
  const k = Math.min(1, (now - t.start) / TWEEN_MS);
  const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return t.from + (t.to - t.from) * eased;
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2620);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  // Warm sky light, a key light from above, and a soft fill so faces read from the camera side.
  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x5a4b38, 1.7));
  const sun = new THREE.DirectionalLight(0xffe8c0, 1.6);
  sun.position.set(6, 12, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.5);
  fill.position.set(-4, 6, 10);
  scene.add(fill);

  const target = new THREE.Vector3();
  const goal = new THREE.Vector3();
  /** Per-second rate the camera closes on its goal when panning. */
  const PAN_RATE = 6;
  let step = 0; // quarter turns, unbounded so tweens always take the short way
  let azimuth: Tween = { from: Math.PI / 4, to: Math.PI / 4, start: 0 };
  let zoomIndex = 0;
  let zoom: Tween = { from: 1, to: 1, start: 0 };

  let orbitRate = 0;
  let orbitAngle = 0;

  const placeCamera = (now: number) => {
    const a = tweenValue(azimuth, now) + orbitAngle;
    camera.position.set(
      target.x + DISTANCE * Math.cos(ELEVATION) * Math.sin(a),
      target.y + DISTANCE * Math.sin(ELEVATION),
      target.z + DISTANCE * Math.cos(ELEVATION) * Math.cos(a),
    );
    camera.lookAt(target);
    const z = tweenValue(zoom, now);
    if (camera.zoom !== z) {
      camera.zoom = z;
      camera.updateProjectionMatrix();
    }
    // Keep matrices current between renders so picking always matches the view.
    camera.updateMatrixWorld();
  };

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

  const handle: SceneHandle = {
    scene,
    camera,
    renderer,
    onFrame: null,
    rotate(dir) {
      const now = performance.now();
      step += dir;
      azimuth = { from: tweenValue(azimuth, now), to: Math.PI / 4 + (step * Math.PI) / 2, start: now };
    },
    zoom(dir) {
      const next = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomIndex + dir));
      if (next === zoomIndex) return;
      const now = performance.now();
      zoomIndex = next;
      zoom = { from: tweenValue(zoom, now), to: ZOOM_STEPS[next]!, start: now };
    },
    lookAt(v) {
      target.copy(v);
      goal.copy(v);
    },
    focus(v) {
      goal.copy(v);
    },
    orbit(rate) {
      orbitRate = rate;
      if (!rate) orbitAngle = 0;
    },
  };

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = timer.getDelta();
    target.lerp(goal, 1 - Math.exp(-dt * PAN_RATE));
    orbitAngle += orbitRate * dt;
    placeCamera(performance.now());
    handle.onFrame?.(dt);
    renderer.render(scene, camera);
  });
  return handle;
}
