import { facingOfStep, gridFromRows, stepToward } from './grid';
import { createUnit, effectiveStats } from './jobs';
import { advance, type Step } from './turn';
import type { Facing, Pos, Stat, Unit } from './types';

export type BattleSetup = {
  rows: string[];
  /** Spawn tiles by side; 'player' tiles are handed out in squad order. */
  spawns: { player: Pos[]; enemy: Pos[] };
  /** The player squad as it stands between battles (JP, jobs and loadouts persist). */
  squad: Unit[];
  enemies: { name: string; job: string }[];
  base: Record<Stat, number>;
};

/** A squad member ready for a new battle: full HP and MP, no CT, statuses or Resolve. */
export function readyForBattle(unit: Unit, pos: Pos, facing: Facing): Unit {
  const { downedTurns: _, ...rest } = unit;
  const fresh: Unit = { ...rest, pos, facing, ct: 0, resolve: 0, statuses: [] };
  const stats = effectiveStats(fresh);
  return { ...fresh, hp: stats.hp, mp: stats.mp };
}

/** Places both sides and runs the clock to the first phase. */
export function setupBattle(setup: BattleSetup): Step {
  const grid = gridFromRows(setup.rows);
  const place = (side: 'player' | 'enemy', i: number): Pos => {
    const pos = setup.spawns[side][i];
    if (!pos) throw new Error(`not enough ${side} spawns for ${i + 1} units`);
    return pos;
  };
  // Each side starts facing the other's spawn area along its dominant axis.
  const facing = (from: Pos, to: Pos) => facingOfStep(from, stepToward(from, to));
  const toward = (side: 'player' | 'enemy') => setup.spawns[side][0] ?? { x: 0, y: 0 };

  const units: Unit[] = [
    ...setup.squad.map((u, i) => {
      const pos = place('player', i);
      return readyForBattle(u, pos, facing(pos, toward('enemy')));
    }),
    ...setup.enemies.map((m, i) => {
      const pos = place('enemy', i);
      return createUnit({ id: `e${i}`, ownerId: 'enemy', name: m.name, job: m.job, base: setup.base, pos, facing: facing(pos, toward('player')) });
    }),
  ];
  return advance({ grid, units, hazards: [], turn: { phase: 'player', active: [] } });
}

/** The squad after a battle: the dead are gone for good; downed units pull through. */
export function survivors(units: readonly Unit[]): Unit[] {
  return units
    .filter((u) => u.ownerId !== 'enemy' && !u.dead)
    .map((u) => {
      const { downedTurns: _, ...rest } = u;
      return { ...rest, statuses: [] };
    });
}

/** A fresh squad of level-1 units; positions are assigned when a battle starts. */
export function newSquad(entries: { name: string; job: string; ownerId: string }[], base: Record<Stat, number>): Unit[] {
  return entries.map((m, i) => createUnit({ id: `p${i}`, ownerId: m.ownerId, name: m.name, job: m.job, base, pos: { x: 0, y: 0 }, facing: 0 }));
}
