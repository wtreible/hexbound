import { banditPair } from './data/enemies';
import { glade } from './data/maps/glade';
import { BASE_STATS, testSquad } from './data/units';
import { createScene } from './render/scene';
import { newSquad, setupBattle, survivors } from './rules/battle';
import { createRng } from './rules/rng';
import type { Unit } from './rules/types';
import { mountBattle } from './ui/battle';
import { mountCamp } from './ui/camp';
import { mountLobby } from './ui/lobby';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const uiRoot = document.querySelector<HTMLElement>('#ui')!;

const view = createScene(canvas);
const rng = createRng(Date.now() >>> 0);

// Test loop: camp -> battle -> camp, with the squad's jobs and JP carried
// between battles. Units alternate between player slots p1 and p2 so
// cross-player combos (Ignite) can be tried hot-seat.
//
// TEMPORARY (decision 0014): a quick 2v2 on the small glade map so test
// rounds play fast. Not part of the game design; delete this block, the
// glade map and banditPair once it's no longer needed for playtesting.
const TEST_SQUAD_SIZE = 2;
const freshSquad = () =>
  newSquad(
    testSquad.slice(0, TEST_SQUAD_SIZE).map((m, i) => ({ ...m, ownerId: i % 2 === 0 ? 'p1' : 'p2' })),
    BASE_STATS,
  );

let squad: Unit[] = freshSquad();
let battlesWon = 0;

function camp(notice?: string) {
  const screen = mountCamp(uiRoot, {
    squad,
    battlesWon,
    notice,
    onChange: (next) => {
      squad = next;
    },
    onStart: () => {
      screen.dispose();
      battle();
    },
  });
}

function battle() {
  const { state } = setupBattle({ rows: glade.rows, spawns: glade.spawns, squad, enemies: banditPair, base: BASE_STATS });
  const b = mountBattle(view, uiRoot, state, rng, (final) => {
    b.dispose();
    if (final.turn.phase === 'over' && final.turn.winner === 'player') battlesWon++;
    squad = survivors(final.units);
    if (squad.length) {
      camp();
    } else {
      squad = freshSquad();
      camp('The company was wiped out. New recruits have joined.');
    }
  });
}

camp();
mountLobby(uiRoot);
