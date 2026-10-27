import { ABILITIES } from '../data/abilities';
import { JOBS } from '../data/jobs';
import type { AbilityDef, Facing, JobDef, Pos, Stat, Unit } from './types';

// Job-derived stats and ability lists. JP, ranks and mastery arrive in M4.

export function jobOf(unit: Unit): JobDef {
  const job = JOBS[unit.job];
  if (!job) throw new Error(`unknown job ${unit.job}`);
  return job;
}

export function ability(id: string): AbilityDef {
  const a = ABILITIES[id];
  if (!a) throw new Error(`unknown ability ${id}`);
  return a;
}

const MULTIPLIED: Stat[] = ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd', 'evade'];

/** Stats after job multipliers and statuses. */
export function effectiveStats(unit: Unit): Record<Stat, number> {
  const job = jobOf(unit);
  const s = { ...unit.base };
  for (const stat of MULTIPLIED) s[stat] = Math.round(unit.base[stat] * (job.statMods[stat] ?? 1));
  s.move = job.move + unit.base.move;
  s.jump = job.jump + unit.base.jump;
  for (const status of unit.statuses) {
    if (status.id === 'guard') s.def = Math.round(s.def * 1.5);
    if (status.id === 'pinned') s.move = Math.max(0, s.move - 2);
  }
  return s;
}

/** Basic attack first, then the job's action set. */
export function abilitiesOf(unit: Unit): AbilityDef[] {
  const job = jobOf(unit);
  return [job.attack, ...job.actionSet.map((a) => a.abilityId)].map(ability);
}

export type NewUnit = {
  id: string;
  ownerId: string;
  name: string;
  job: string;
  base: Record<Stat, number>;
  pos: Pos;
  facing: Facing;
};

/** A fresh level-1 unit at full HP and MP. */
export function createUnit(spec: NewUnit): Unit {
  const unit: Unit = { ...spec, level: 1, hp: 0, mp: 0, ct: 0, statuses: [] };
  const stats = effectiveStats(unit);
  return { ...unit, hp: stats.hp, mp: stats.mp };
}
