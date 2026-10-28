import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import { audio } from './audio';
import { glade } from './data/maps/glade';
import { mountBackdrop } from './render/backdrop';
import { loadModels, type ModelLibrary } from './render/models';
import { createPortraits, type Portraits } from './render/portraits';
import { BASE_STATS } from './data/units';
import { createScene } from './render/scene';
import { setupBattle, type BattleSetup } from './rules/battle';
import { createRng } from './rules/rng';
import { battleFor, enterNode, finishBattle, isBattle, leaveNode, newRun, node, recruit, type RunState } from './rules/run';
import { loadProfile, saveProfile } from './profile';
import { newUnlocks, recordRun, shrinePool } from './rules/profile';
import { clearRun, loadRun, saveRun } from './save';
import { mountBattle } from './ui/battle';
import { mountCamp } from './ui/camp';
import { mountCodex } from './ui/codex';
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
// (the encounter's first two enemies) on the small glade map; the AI plays
// both sides at double speed. Delete this block and the glade map when no
// longer needed.
const QUICK = new URLSearchParams(location.search).has('quick');
const SQUAD_SIZE = QUICK ? 2 : 4;
const QUICK_SPEED = 2;
function quickBattle(setup: BattleSetup): BattleSetup {
  if (!QUICK) return setup;
  const enemies = setup.enemies.slice(0, 2);
  // The glade has no exits or hold zone, so those objectives become a rout.
  const objective = setup.objective === 'leader' ? 'leader' : 'rout';
  return { ...setup, rows: glade.rows, spawns: glade.spawns, enemies, objective };
}

// One screen at a time; each mount returns something to dispose. Menus get the
// living diorama behind them; battles bring their own board.
let current: { dispose(): void } | null = null;
let backdrop: { dispose(): void } | null = null;
const show = (next: () => { dispose(): void }, opts: { backdrop: boolean } = { backdrop: true }) => {
  current?.dispose();
  if (opts.backdrop && !backdrop) backdrop = mountBackdrop(view, library);
  if (!opts.backdrop && backdrop) {
    backdrop.dispose();
    backdrop = null;
  }
  current = next();
};

let library: ModelLibrary | null = null;
let portraits: Portraits | null = null;

/** Meta progression, folded in after every step so an abandoned run still counts what it found. */
let profile = loadProfile();
const record = (run: RunState, finished = false) => {
  profile = recordRun(profile, run, finished);
  saveProfile(profile);
};

/** Saves the run and shows whatever screen its state calls for. */
function go(run: RunState) {
  saveRun(run);
  const here = run.at ? node(run, run.at) : null;
  audio.music(run.status === 'node' && here && isBattle(here.type) ? 'battle' : 'exploration');
  if (run.status === 'won' || run.status === 'lost') {
    clearRun();
    const before = profile;
    record(run, true);
    const unlocks = newUnlocks(before, profile);
    show(() => mountResults(uiRoot, run, unlocks, () => draft()));
    return;
  }
  record(run);
  if (run.status === 'map') {
    show(() =>
      mountRunMap(uiRoot, run, {
        onEnter: (id) => {
          audio.play('page');
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
      () =>
        mountBattle(view, uiRoot, state, createRng(b.seed), (final) => go(finishBattle(run, final)), {
          title: label,
          autoPlay: QUICK,
          speed: QUICK ? QUICK_SPEED : 1,
          library,
          portraits,
        }),
      { backdrop: false },
    );
  } else if (n.type === 'camp') {
    const onChange = (latest: RunState) => {
      saveRun(latest);
      record(latest);
    };
    show(() => mountCamp(uiRoot, run, { onChange, onLeave: (latest) => go(leaveNode(latest)), portraits }));
  } else if (n.type === 'shop') {
    show(() => mountShop(uiRoot, run, { onChange: saveRun, onLeave: (latest) => go(leaveNode(latest)) }));
  } else if (n.type === 'shrine') {
    show(() => mountShrine(uiRoot, run, { onChoose: go, onLeave: () => go(leaveNode(run)) }));
  } else if (n.type === 'recruit') {
    show(() =>
      mountRecruit(uiRoot, run, {
        onRecruit: (id) => {
          const r = recruit(run, id);
          if ('error' in r) console.warn(r.error);
          else go(r);
        },
        onLeave: () => go(leaveNode(run)),
        portraits,
      }),
    );
  }
}

function draft() {
  show(() =>
    mountDraft(uiRoot, SQUAD_SIZE, profile, (picks, relic) => {
      go(newRun({ seed: Date.now() >>> 0, draft: picks, base: BASE_STATS, squadSize: SQUAD_SIZE, relic, shrinePool: shrinePool(profile) }));
    }),
  );
}

function title() {
  audio.music('exploration');
  const saved = loadRun();
  show(() =>
    mountTitle(uiRoot, saved, {
      onContinue: () => saved && go(saved),
      onNew: () => draft(),
      onCodex: () => show(() => mountCodex(uiRoot, profile, title)),
    }),
  );
}

// Every button clicks.
document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLElement && e.target.closest('button')) audio.play('click');
});

// Sound toggle, top right.
const mute = document.createElement('button');
mute.className = 'mute-toggle';
const label = () => (mute.textContent = audio.muted ? 'Sound off' : 'Sound on');
label();
mute.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  label();
});
uiRoot.appendChild(mute);

// The M0 networking smoke test, until the real lobby arrives with M3.
if (new URLSearchParams(location.search).has('net')) mountLobby(uiRoot);

// Load the character models before the first screen; capsules stand in if that fails.
const loading = document.createElement('div');
loading.className = 'loading';
loading.textContent = 'Loading…';
uiRoot.appendChild(loading);
loadModels(import.meta.env.BASE_URL)
  .then((lib) => {
    library = lib;
    portraits = createPortraits(lib);
  })
  .catch((err) => console.warn('[models] falling back to capsules', err))
  .finally(() => {
    loading.remove();
    title();
  });
