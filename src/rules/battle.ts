import { facingOfStep, gridFromRows, stepToward } from './grid';
import { createUnit } from './jobs';
import { advance, type Step } from './turn';
import type { Pos, Stat, Unit } from './types';

export type BattleSetup = {
  rows: string[];
  /** Spawn tiles by side; 'player' tiles are handed out in squad order. */
  spawns: { player: Pos[]; enemy: Pos[] };
  squad: { name: string; job: string; ownerId: string }[];
  enemies: { name: string; job: string }[];
  base: Record<Stat, number>;
};

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
    ...setup.squad.map((m, i) => {
      const pos = place('player', i);
      return createUnit({ id: `p${i}`, ownerId: m.ownerId, name: m.name, job: m.job, base: setup.base, pos, facing: facing(pos, toward('enemy')) });
    }),
    ...setup.enemies.map((m, i) => {
      const pos = place('enemy', i);
      return createUnit({ id: `e${i}`, ownerId: 'enemy', name: m.name, job: m.job, base: setup.base, pos, facing: facing(pos, toward('player')) });
    }),
  ];
  return advance({ grid, units, turn: { phase: 'player', active: [] } });
}
