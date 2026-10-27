import * as THREE from 'three';
import type { TerrainId } from '../rules/types';

// Procedural pixel textures for tiles (docs/DESIGN.md §9.1: a top texture
// plus darker side faces). Generated at startup from a fixed seed, so they
// look the same every time and need no asset files.

const SIZE = 32;

type Palette = { base: [number, number, number]; spread: number; accents: [number, number, number][] };

const TOPS: Record<TerrainId, Palette> = {
  grass: { base: [112, 138, 70], spread: 14, accents: [[138, 162, 84], [92, 116, 58], [150, 168, 92]] },
  dirt: { base: [150, 118, 80], spread: 12, accents: [[128, 98, 66], [170, 138, 96], [112, 88, 62]] },
  stone: { base: [138, 132, 120], spread: 10, accents: [[112, 106, 96], [158, 152, 140]] },
  water: { base: [70, 112, 134], spread: 6, accents: [[110, 156, 176], [58, 96, 118]] },
};

/** Deterministic pseudo-random numbers so textures are stable between loads. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, lcg(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const rgb = ([r, g, b]: [number, number, number], d = 0) => `rgb(${r + d},${g + d},${b + d})`;

function speckle(ctx: CanvasRenderingContext2D, rand: () => number, p: Palette) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const accent = rand() < 0.18 ? p.accents[Math.floor(rand() * p.accents.length)]! : p.base;
      ctx.fillStyle = rgb(accent, Math.round((rand() - 0.5) * p.spread));
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** The walkable top of a tile. */
export function topTexture(terrain: TerrainId): THREE.CanvasTexture {
  return canvasTexture((ctx, rand) => {
    speckle(ctx, rand, TOPS[terrain]);
    if (terrain === 'stone') {
      // Flagstone seams.
      ctx.fillStyle = 'rgba(70,64,56,0.55)';
      ctx.fillRect(0, 15, SIZE, 1);
      ctx.fillRect(15, 0, 1, 15);
      ctx.fillRect(7, 16, 1, 16);
      ctx.fillRect(23, 16, 1, 16);
    }
    if (terrain === 'water') {
      ctx.fillStyle = 'rgba(200,228,236,0.45)';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(rand() * 24), Math.floor(rand() * SIZE), 6, 1);
    }
  }, terrain.length * 977);
}

/** One tier of a tile's side: darker earth (or rock) in horizontal bands. Repeats vertically per tier. */
export function sideTexture(terrain: TerrainId): THREE.CanvasTexture {
  const earth: Palette =
    terrain === 'stone'
      ? { base: [96, 90, 82], spread: 10, accents: [[80, 74, 68], [110, 104, 96]] }
      : { base: [104, 78, 54], spread: 12, accents: [[88, 64, 44], [120, 92, 64]] };
  return canvasTexture((ctx, rand) => {
    speckle(ctx, rand, earth);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, SIZE, 1);
    ctx.fillRect(0, 16, SIZE, 1);
  }, terrain.length * 7919);
}
