import { banditGroup } from './data/enemies';
import { meadow } from './data/maps/meadow';
import { BASE_STATS, testSquad } from './data/units';
import { createScene } from './render/scene';
import { setupBattle } from './rules/battle';
import { createRng } from './rules/rng';
import { mountBattle } from './ui/battle';
import { mountLobby } from './ui/lobby';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const uiRoot = document.querySelector<HTMLElement>('#ui')!;

const view = createScene(canvas);

// M2: a solo 4v4 Rout battle on a fixed map with the test squad.
const { state } = setupBattle({
  rows: meadow.rows,
  spawns: meadow.spawns,
  squad: testSquad.map((m) => ({ ...m, ownerId: 'p1' })),
  enemies: banditGroup,
  base: BASE_STATS,
});

mountBattle(view, uiRoot, state, createRng(Date.now() >>> 0));
mountLobby(uiRoot);
