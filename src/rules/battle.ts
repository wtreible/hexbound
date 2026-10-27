import { facingOfStep, gridFromRows, stepToward } from './grid';
import { createUnit, effectiveStats } from './jobs';
import { HOLD_ROUNDS } from './objectives';
import { advance, type Step } from './turn';
import type { Facing, Objective, Pos, Stat, Unit } from './types';

export type ObjectiveType = Objective['type'];

export type BattleSetup = {
  rows: string[];
  /** Spawn tiles by side; 'player' tiles are handed out in squad order. */
  spawns: { player: Pos[]; enemy: Pos[] };
  /** Default 'rout'. Leader marks the first enemy; the others need the map markers below. */
  objective?: ObjectiveType;
  exits?: Pos[];
  hold?: Pos[];
  /** Where the escorted unit starts. */
  vip?: Pos;
  /** The player squad as it stands between battles (JP, jobs, loadouts and HP persist). */
  squad: Unit[];
  enemies: EnemySpec[];
  base: Record<Stat, number>;
  /** The party's consumables, carried into battle. */
  inventory?: Record<string, number>;
};

export type EnemySpec = {
  name: string;
  job: string;
  level?: number;
  /** Multipliers on base stats after levelling, for bosses. */
  scale?: Partial<Record<Stat, number>>;
};

/**
 * A squad member ready for a new battle: HP carries over (capped at the
 * current maximum), MP refills, and CT, statuses and Resolve reset.
 */
export function readyForBattle(unit: Unit, pos: Pos, facing: Facing): Unit {
  const { downedRounds: _d, escaped: _e, ...rest } = unit;
  const fresh: Unit = { ...rest, pos, facing, ct: 0, resolve: 0, statuses: [] };
  const stats = effectiveStats(fresh);
  return { ...fresh, hp: Math.max(1, Math.min(unit.hp, stats.hp)), mp: stats.mp };
}

function createEnemy(spec: EnemySpec, i: number, base: Record<Stat, number>, pos: Pos, facing: Facing): Unit {
  let u = createUnit({ id: `e${i}`, ownerId: 'enemy', name: spec.name, job: spec.job, base, pos, facing, level: spec.level });
  if (spec.scale) {
    const scaled = { ...u.base };
    for (const [stat, m] of Object.entries(spec.scale)) scaled[stat as Stat] *= m;
    u = { ...u, base: scaled };
    const stats = effectiveStats(u);
    u = { ...u, hp: stats.hp, mp: stats.mp };
  }
  return u;
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
    ...setup.enemies.map((spec, i) => {
      const pos = place('enemy', i);
      return createEnemy(spec, i, setup.base, pos, facing(pos, toward('player')));
    }),
  ];
  const objective = buildObjective(setup, units);
  if (objective.type === 'escort') {
    const level = setup.enemies[0]?.level ?? 1;
    const pos = setup.vip!;
    units.push(createUnit({ id: objective.unitId, ownerId: 'npc', name: 'Pilgrim', job: 'chemist', base: setup.base, pos, facing: facing(pos, toward('enemy')), level }));
  }
  return advance({
    grid,
    units,
    objective,
    casts: [],
    hazards: [],
    round: { n: 0, waiting: [] },
    inventory: { ...setup.inventory },
    loot: [],
    turn: { phase: 'player', active: [] },
  });
}

function buildObjective(setup: BattleSetup, units: Unit[]): Objective {
  const type = setup.objective ?? 'rout';
  const need = <T>(value: T | undefined, what: string): T => {
    if (value === undefined || (Array.isArray(value) && !value.length)) throw new Error(`${type} objective needs map ${what}`);
    return value;
  };
  switch (type) {
    case 'rout':
      return { type };
    case 'leader':
      return { type, unitId: units.find((u) => u.ownerId === 'enemy')!.id };
    case 'escort':
      need(setup.vip, 'vip');
      return { type, unitId: 'vip', exits: need(setup.exits, 'exits') };
    case 'hold':
      return { type, tiles: need(setup.hold, 'hold tiles'), rounds: HOLD_ROUNDS, held: 0 };
    case 'escape':
      return { type, exits: need(setup.exits, 'exits') };
  }
}

/** The squad after a battle: the dead are gone for good; downed units pull through at 1 HP; escapees return. */
export function survivors(units: readonly Unit[]): Unit[] {
  return units
    .filter((u) => u.ownerId !== 'enemy' && u.ownerId !== 'npc' && !u.dead)
    .map((u) => {
      const { downedRounds: _d, escaped: _e, ...rest } = u;
      return { ...rest, hp: Math.max(1, u.hp), statuses: [] };
    });
}

/** A fresh squad of level-1 units; positions are assigned when a battle starts. */
export function newSquad(entries: { name: string; job: string; ownerId: string }[], base: Record<Stat, number>): Unit[] {
  return entries.map((m, i) => createUnit({ id: `p${i}`, ownerId: m.ownerId, name: m.name, job: m.job, base, pos: { x: 0, y: 0 }, facing: 0 }));
}
