import { BASE_STATS } from '../src/data/units';
import { gridFromRows } from '../src/rules/grid';
import { createUnit } from '../src/rules/jobs';
import type { Facing, GameState, Hazard, Pos, Stat, Unit } from '../src/rules/types';

export function makeUnit(
  id: string,
  ownerId: string,
  job: string,
  pos: Pos,
  opts: { facing?: Facing; base?: Partial<Record<Stat, number>>; patch?: Partial<Unit> } = {},
): Unit {
  const unit = createUnit({ id, ownerId, name: id, job, base: { ...BASE_STATS, ...opts.base }, pos, facing: opts.facing ?? 2 });
  return { ...unit, ...opts.patch };
}

/** A battle state where the given units are the active player (or enemy) phase. */
export function battle(rows: string[], units: Unit[], active: string[], phase: 'player' | 'enemy' = 'player', hazards: Hazard[] = []): GameState {
  return {
    grid: gridFromRows(rows),
    units,
    hazards,
    turn: { phase, active: active.map((unitId) => ({ unitId, moved: false, acted: false })) },
  };
}

export const flat = (w: number, h: number): string[] => Array.from({ length: h }, () => '0'.repeat(w));
