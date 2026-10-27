import { meadow } from './data/maps/meadow';
import { DEFAULT_STATS, placeholderRoster } from './data/units';
import { createScene } from './render/scene';
import { gridFromRows } from './rules/grid';
import { createRng } from './rules/rng';
import type { GameState, Unit } from './rules/types';
import { mountBattle } from './ui/battle';
import { mountLobby } from './ui/lobby';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const uiRoot = document.querySelector<HTMLElement>('#ui')!;

const view = createScene(canvas);

// M1: hot-seat battle on a fixed map with the placeholder roster.
const spawnsUsed: Record<string, number> = {};
const units: Unit[] = placeholderRoster.map((entry, i) => {
  const slot = spawnsUsed[entry.ownerId] ?? 0;
  spawnsUsed[entry.ownerId] = slot + 1;
  const pos = meadow.spawns[entry.ownerId]?.[slot];
  if (!pos) throw new Error(`no spawn ${slot} for ${entry.ownerId} on ${meadow.id}`);
  return {
    id: `u${i}`,
    ownerId: entry.ownerId,
    name: entry.name,
    base: { ...DEFAULT_STATS, ...entry.stats },
    pos,
    facing: entry.ownerId === 'p1' ? 0 : 2,
  };
});
const state: GameState = { grid: gridFromRows(meadow.rows), units };

mountBattle(view, uiRoot, state, createRng(Date.now() >>> 0));
mountLobby(uiRoot);
