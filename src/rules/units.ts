import type { Unit } from './types';

// Side and life-state helpers. All player slots are one side in co-op;
// 'enemy' is the other.

export const isEnemy = (u: Unit): boolean => u.ownerId === 'enemy';

export const sameSide = (a: Unit, b: Unit): boolean => isEnemy(a) === isEnemy(b);

/** Alive and not downed: can act, be targeted by damage and count for Rout. */
export const isStanding = (u: Unit): boolean => !u.dead && u.downedTurns === undefined;

export const isDowned = (u: Unit): boolean => !u.dead && u.downedTurns !== undefined;

export function findUnit(units: readonly Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

/** The living or downed unit on a tile; graves don't occupy tiles. */
export function unitAt(units: readonly Unit[], x: number, y: number): Unit | undefined {
  return units.find((u) => !u.dead && u.pos.x === x && u.pos.y === y);
}
