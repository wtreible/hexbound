import type { Unit } from './types';

// Side and life-state helpers. All player slots are one side in co-op;
// 'enemy' is the other.

export const isEnemy = (u: Unit): boolean => u.ownerId === 'enemy';

/** AI-controlled units on the player's side that aren't in the squad (the Escort objective's charge). */
export const isNpc = (u: Unit): boolean => u.ownerId === 'npc';

export const sameSide = (a: Unit, b: Unit): boolean => isEnemy(a) === isEnemy(b);

/** On the board, alive and not downed: can act, be targeted by damage and count for Rout. */
export const isStanding = (u: Unit): boolean => !u.dead && !u.escaped && u.downedRounds === undefined;

export const isDowned = (u: Unit): boolean => !u.dead && u.downedRounds !== undefined;

export function findUnit(units: readonly Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

/** The living or downed unit on a tile; graves and escaped units don't occupy tiles. */
export function unitAt(units: readonly Unit[], x: number, y: number): Unit | undefined {
  return units.find((u) => !u.dead && !u.escaped && u.pos.x === x && u.pos.y === y);
}
