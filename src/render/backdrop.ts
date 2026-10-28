import * as THREE from 'three';
import { BASE_STATS } from '../data/units';
import { meadow } from '../data/maps/meadow';
import { gridFromRows } from '../rules/grid';
import { createUnit } from '../rules/jobs';
import type { Unit } from '../rules/types';
import { createBoard } from './board';
import type { ModelLibrary } from './models';
import type { SceneHandle } from './scene';
import { createUnits } from './units';

// A living diorama behind the menus: the meadow with a few idle adventurers
// and skeletons, the camera slowly circling (decision 0022).

const ORBIT = 0.05; // radians per second

export function mountBackdrop(view: SceneHandle, library: ModelLibrary | null): { dispose(): void } {
  const world = new THREE.Group();
  view.scene.add(world);
  const grid = gridFromRows(meadow.rows);
  const board = createBoard(world, grid);
  const units = createUnits(world, grid, library, { bars: false });
  const cast: [string, string, number, number, 0 | 1 | 2 | 3][] = [
    ['p1', 'squire', 3, 8, 1],
    ['p1', 'archer', 2, 9, 1],
    ['p2', 'mage', 4, 9, 0],
    ['enemy', 'squire', 8, 3, 2],
    ['enemy', 'archer', 9, 2, 3],
  ];
  const actors: Unit[] = cast.map(([ownerId, job, x, y, facing], i) =>
    createUnit({ id: `b${i}`, ownerId, name: '', job, base: BASE_STATS, pos: { x, y }, facing }),
  );
  units.sync(actors);
  view.lookAt(board.center);
  view.orbit(ORBIT);
  view.onFrame = (dt) => {
    units.update(dt);
    board.update(dt);
  };
  return {
    dispose() {
      view.onFrame = null;
      view.orbit(0);
      view.scene.remove(world);
    },
  };
}
