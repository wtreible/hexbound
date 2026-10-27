import type { GameEvent, GameState, Objective, Pos, Unit } from './types';
import { isEnemy, isNpc, isStanding } from './units';

// Battle objectives (docs/DESIGN.md §5.2; decision 0017). Routing the enemy
// always wins. Losing means no player unit is left standing, unless some
// escaped, or (Escort) the escorted unit goes down.

export const HOLD_ROUNDS = 4;

const onAny = (p: Pos, tiles: readonly Pos[]) => tiles.some((t) => t.x === p.x && t.y === p.y);

export function winner(state: GameState): 'player' | 'enemy' | null {
  const { units, objective } = state;
  const enemiesStanding = units.some((u) => isEnemy(u) && isStanding(u));
  const players = units.filter((u) => !isEnemy(u) && !isNpc(u));
  const playersStanding = players.some(isStanding);
  const escaped = players.some((u) => u.escaped);

  if (objective.type === 'escort') {
    const vip = units.find((u) => u.id === objective.unitId);
    if (!vip || !isStanding(vip)) return 'enemy';
    if (onAny(vip.pos, objective.exits)) return 'player';
  }
  if (!playersStanding) return escaped ? 'player' : 'enemy';
  if (!enemiesStanding) return 'player';
  if (objective.type === 'leader') {
    const leader = units.find((u) => u.id === objective.unitId);
    if (!leader || !isStanding(leader)) return 'player';
  }
  if (objective.type === 'hold' && objective.held >= objective.rounds) return 'player';
  return null;
}

/** Hold: at each round start, the ground counts as held if only player units stand on it. */
export function roundStart(objective: Objective, units: readonly Unit[], events: GameEvent[]): Objective {
  if (objective.type !== 'hold') return objective;
  const on = units.filter((u) => isStanding(u) && onAny(u.pos, objective.tiles));
  if (!on.length || on.some(isEnemy)) return objective;
  const held = objective.held + 1;
  events.push({ type: 'held', held, rounds: objective.rounds });
  return { ...objective, held };
}

/** Escape: a player unit that ends a move on an exit leaves the battlefield. */
export function escapes(state: GameState, unit: Unit): boolean {
  return state.objective.type === 'escape' && !isEnemy(unit) && !isNpc(unit) && isStanding(unit) && onAny(unit.pos, state.objective.exits);
}

/** Tiles to mark on the board, and a one-line description for the HUD. */
export function describe(state: GameState): { exits: Pos[]; hold: Pos[]; text: string } {
  const o = state.objective;
  const name = (id: string) => state.units.find((u) => u.id === id)?.name ?? '?';
  switch (o.type) {
    case 'rout':
      return { exits: [], hold: [], text: 'Defeat every enemy.' };
    case 'leader':
      return { exits: [], hold: [], text: `Defeat ${name(o.unitId)}.` };
    case 'escort':
      return { exits: o.exits, hold: [], text: `Get ${name(o.unitId)} to the exit alive.` };
    case 'hold':
      return { exits: [], hold: o.tiles, text: `Hold the marked ground for ${o.rounds} rounds (${o.held}/${o.rounds}), or rout the enemy.` };
    case 'escape':
      return { exits: o.exits, hold: [], text: 'Reach the exits: everyone standing must escape, or rout the enemy.' };
  }
}

