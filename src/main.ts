import * as THREE from 'three';
import { createScene } from './render/scene';
import { mountLobby } from './ui/lobby';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const uiRoot = document.querySelector<HTMLElement>('#ui')!;

const view = createScene(canvas);

// M0 placeholder: a rotating cube proves the render loop runs on the live URL.
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({ color: 0xb08d3c }),
);
view.scene.add(cube);
view.onFrame = (dt) => {
  cube.rotation.y += dt * 0.8;
};

mountLobby(uiRoot);
