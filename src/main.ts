import { glade } from './data/maps/glade';
import { BASE_STATS } from './data/units';
import { createScene } from './render/scene';
import { setupBattle, type BattleSetup } from './rules/battle';
import { createRng } from './rules/rng';
import type { Stat } from './rules/types';
import { battleFor, enterNode, finishBattle, isBattle, leaveNode, newRun, node, recruit, type RunState } from './rules/run';
import { clearRun, loadRun, saveRun } from './save';
import { mountBattle } from './ui/battle';
import { mountCamp } from './ui/camp';
import { mountDraft } from './ui/draft';
import { mountLobby } from './ui/lobby';
import { mountRecruit } from './ui/recruit';
import { mountResults } from './ui/results';
import { mountRunMap, NODE_LOOK } from './ui/runMap';
import { mountShop } from './ui/shop';
import { mountShrine } from './ui/shrine';
import { mountTitle } from './ui/title';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const uiRoot = document.querySelector<HTMLElement>('#ui')!;
const view = createScene(canvas);

// TEMPORARY (decision 0014): ?quick is a turbo test mode for checking
// progression and the run, not combat. A squad of 2; every battle is a 2v2
// (the encounter's first two enemies, weakened) on the small glade map; the
// AI plays both sides at double speed. Delete this block and the glade map
// when no longer needed.
const QUICK = new URLSearchParams(location.search).has('quick');
const SQUAD_SIZE = QUICK ? 2 : 4;
const QUICK_SPEED = 2;
const QUICK_ENEMY_SCALE = 0.7;
function quickBattle(setup: BattleSetup): BattleSetup {
  if (!QUICK) return setup;
  const enemies = setup.enemies.slice(0, 2).map((e) => {
    const scale: Partial<Record<Stat, number>> = { ...e.scale };
    for (const stat of ['hp', 'atk', 'mag', 'def', 'res'] as const) scale[stat] = (scale[stat] ?? 1) * QUICK_ENEMY_SCALE;
    return { ...e, scale };
  });
  // The glade has no exits or hold zone, so those objectives become a rout.
  const objective = setup.objective === 'leader' ? 'leader' : 'rout';
  return { ...setup, rows: glade.rows, spawns: glade.spawns, enemies, objective };
}

// One screen at a time; each mount returns something to dispose.
let current: { dispose(): void } | null = null;
const show = (next: { dispose(): void }) => {
  current?.dispose();
  current = next;
};

/** Saves the run and shows whatever screen its state calls for. */
function go(run: RunState) {
  saveRun(run);
  if (run.status === 'won' || run.status === 'lost') {
    clearRun();
    show(mountResults(uiRoot, run, () => draft()));
    return;
  }
  if (run.status === 'map') {
    show(
      mountRunMap(uiRoot, run, {
        onEnter: (id) => {
          const r = enterNode(run, id, BASE_STATS);
          if ('error' in r) console.warn(r.error);
          else go(r);
        },
        onAbandon: () => {
          if (confirm('Abandon this run? It cannot be resumed.')) {
            clearRun();
            title();
          }
        },
      }),
    );
    return;
  }
  const n = node(run, run.at!);
  if (isBattle(n.type)) {
    const b = battleFor(run, BASE_STATS);
    const { state } = setupBattle(quickBattle(b.setup));
    const label = `${n.type === 'battle' ? '' : `${NODE_LOOK[n.type].name}: `}${b.encounter.name} · ${b.mapName}`;
    show(
      mountBattle(view, uiRoot, state, createRng(b.seed), (final) => go(finishBattle(run, final)), {
        title: label,
        autoPlay: QUICK,
        speed: QUICK ? QUICK_SPEED : 1,
      }),
    );
  } else if (n.type === 'camp') {
    show(mountCamp(uiRoot, run, { onChange: saveRun, onLeave: (latest) => go(leaveNode(latest)) }));
  } else if (n.type === 'shop') {
    show(mountShop(uiRoot, run, { onChange: saveRun, onLeave: (latest) => go(leaveNode(latest)) }));
  } else if (n.type === 'shrine') {
    show(mountShrine(uiRoot, run, { onChoose: go, onLeave: () => go(leaveNode(run)) }));
  } else if (n.type === 'recruit') {
    show(
      mountRecruit(uiRoot, run, {
        onRecruit: (id) => {
          const r = recruit(run, id);
          if ('error' in r) console.warn(r.error);
          else go(r);
        },
        onLeave: () => go(leaveNode(run)),
      }),
    );
  }
}

function draft() {
  show(
    mountDraft(uiRoot, SQUAD_SIZE, (picks) => {
      go(newRun({ seed: Date.now() >>> 0, draft: picks, base: BASE_STATS, squadSize: SQUAD_SIZE }));
    }),
  );
}

function title() {
  const saved = loadRun();
  show(
    mountTitle(uiRoot, saved, {
      onContinue: () => saved && go(saved),
      onNew: () => draft(),
    }),
  );
}

title();
mountLobby(uiRoot);
