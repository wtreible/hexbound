import { ABILITIES } from '../data/abilities';
import { JOBS } from '../data/jobs';
import type { AbilityDef, Facing, JobDef, JobId, PassiveEffect, Pos, Stat, Unit } from './types';

// Jobs and progression (docs/DESIGN.md §6.1, §6.2): derived stats, ranks from
// JP, which abilities a unit can use, and loadout changes made at camp.

/** JP needed for Rank 1, Rank 2 and mastery (Rank 3). */
export const RANK_JP = [60, 150, 300] as const;
export const MASTERED = 3;

export function job(id: JobId): JobDef {
  const j = JOBS[id];
  if (!j) throw new Error(`unknown job ${id}`);
  return j;
}

export const jobOf = (unit: Unit): JobDef => job(unit.job);

export function ability(id: string): AbilityDef {
  const a = ABILITIES[id];
  if (!a) throw new Error(`unknown ability ${id}`);
  return a;
}

export function rankForJp(jp: number): number {
  return RANK_JP.filter((t) => jp >= t).length;
}

export const rankOf = (unit: Unit, jobId: JobId): number => rankForJp(unit.jp[jobId] ?? 0);
export const isMastered = (unit: Unit, jobId: JobId): boolean => rankOf(unit, jobId) >= MASTERED;

/** Effects of the unit's equipped passive. */
export function passiveEffects(unit: Unit): PassiveEffect[] {
  return unit.passive ? (ability(unit.passive).passive ?? []) : [];
}

export const hasPassive = (unit: Unit, type: PassiveEffect['type']): boolean => passiveEffects(unit).some((p) => p.type === type);

const MULTIPLIED: Stat[] = ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd', 'evade'];

/** Stats after job multipliers, the equipped passive and statuses. */
export function effectiveStats(unit: Unit): Record<Stat, number> {
  const j = jobOf(unit);
  const s = { ...unit.base };
  for (const stat of MULTIPLIED) s[stat] = Math.round(unit.base[stat] * (j.statMods[stat] ?? 1));
  s.move = j.move + unit.base.move;
  s.jump = j.jump + unit.base.jump;
  for (const p of passiveEffects(unit)) if (p.type === 'stat') s[p.stat] += p.add;
  for (const status of unit.statuses) {
    if (status.id === 'guard') s.def = Math.round(s.def * 1.5);
    if (status.id === 'pinned') s.move = Math.max(0, s.move - 2);
    if (status.id === 'slow') s.spd = Math.max(1, Math.round(s.spd * 0.5));
    if (status.id === 'haste') s.spd = Math.round(s.spd * 1.5);
    if (status.id === 'veil') s.evade += 30;
  }
  return s;
}

/** Extra max range from passives whose tag matches the ability (Eagle Eye, Throw Range +2). */
export function rangeBonus(unit: Unit, a: AbilityDef): number {
  let bonus = 0;
  for (const p of passiveEffects(unit)) if (p.type === 'range' && a.tags.includes(p.tag)) bonus += p.add;
  return bonus;
}

export function healMultiplier(unit: Unit): number {
  let m = 1;
  for (const p of passiveEffects(unit)) if (p.type === 'heal-boost') m += p.pct;
  return m;
}

export type AbilitySource = 'attack' | 'primary' | 'secondary' | 'ultimate';
export type AbilityEntry = { ability: AbilityDef; source: AbilitySource; rank: number; locked: boolean };

/**
 * Everything on the unit's command list: basic attack, the primary job's
 * action set (locked entries included, for display), the secondary set's
 * unlocked abilities, and the equipped ultimate.
 */
export function abilityEntries(unit: Unit): AbilityEntry[] {
  const primary = jobOf(unit);
  const primaryRank = rankOf(unit, primary.id);
  const entries: AbilityEntry[] = [{ ability: ability(primary.attack), source: 'attack', rank: 0, locked: false }];
  for (const a of primary.actionSet) {
    entries.push({ ability: ability(a.abilityId), source: 'primary', rank: a.rank, locked: a.rank > primaryRank });
  }
  if (unit.secondary) {
    const secondaryRank = rankOf(unit, unit.secondary);
    for (const a of job(unit.secondary).actionSet) {
      if (a.rank <= secondaryRank) entries.push({ ability: ability(a.abilityId), source: 'secondary', rank: a.rank, locked: false });
    }
  }
  if (unit.ultimate) entries.push({ ability: ability(unit.ultimate), source: 'ultimate', rank: MASTERED, locked: false });
  return entries;
}

/** Abilities the unit may use right now, ignoring cost. */
export function abilitiesOf(unit: Unit): AbilityDef[] {
  return abilityEntries(unit).filter((e) => !e.locked).map((e) => e.ability);
}

export function canAfford(unit: Unit, a: AbilityDef): boolean {
  return (a.cost?.mp ?? 0) <= unit.mp && (a.cost?.resolve ?? 0) <= unit.resolve;
}

// --- Progression and loadout (changed only at camp) ---

/** Every base job, plus hybrids whose parent jobs are both mastered. */
export function availableJobs(unit: Unit): JobDef[] {
  return Object.values(JOBS).filter((j) => j.requires.every((r) => isMastered(unit, r)));
}

/** Jobs whose action set can be borrowed: Rank 1 or better, other than the primary. */
export function secondaryOptions(unit: Unit, primary: JobId = unit.job): JobDef[] {
  return Object.values(JOBS).filter((j) => j.id !== primary && rankOf(unit, j.id) >= 1);
}

/** Passives learned from any job at Rank 2 or better. */
export function passiveOptions(unit: Unit): AbilityDef[] {
  return Object.values(JOBS)
    .filter((j) => rankOf(unit, j.id) >= 2)
    .flatMap((j) => j.passives.map(ability));
}

/** Ultimates from mastered jobs. */
export function ultimateOptions(unit: Unit): AbilityDef[] {
  return Object.values(JOBS)
    .filter((j) => isMastered(unit, j.id))
    .map((j) => ability(j.ultimate));
}

export type Loadout = { job: JobId; secondary?: JobId; passive?: string; ultimate?: string };

/** Applies a camp loadout, rejecting anything the unit hasn't unlocked. */
export function setLoadout(unit: Unit, loadout: Loadout): Unit | { error: string } {
  if (!availableJobs(unit).some((j) => j.id === loadout.job)) return { error: `${loadout.job} is locked` };
  if (loadout.secondary && !secondaryOptions(unit, loadout.job).some((j) => j.id === loadout.secondary)) {
    return { error: `can't use ${loadout.secondary} as a secondary` };
  }
  if (loadout.passive && !passiveOptions(unit).some((a) => a.id === loadout.passive)) return { error: `${loadout.passive} not learned` };
  if (loadout.ultimate && !ultimateOptions(unit).some((a) => a.id === loadout.ultimate)) return { error: `${loadout.ultimate} not earned` };
  const { secondary: _s, passive: _p, ultimate: _u, ...rest } = unit;
  const next: Unit = { ...rest, job: loadout.job, jp: { [loadout.job]: 0, ...unit.jp } };
  if (loadout.secondary) next.secondary = loadout.secondary;
  if (loadout.passive) next.passive = loadout.passive;
  if (loadout.ultimate) next.ultimate = loadout.ultimate;
  const stats = effectiveStats(next);
  return { ...next, hp: stats.hp, mp: stats.mp };
}

export type JpGain = { unit: Unit; rank: number; rankUp: boolean };

/** Adds JP to a job (the current one by default) and reports any rank-up. */
export function grantJp(unit: Unit, amount: number, jobId: JobId = unit.job): JpGain {
  const before = rankOf(unit, jobId);
  const next = { ...unit, jp: { ...unit.jp, [jobId]: (unit.jp[jobId] ?? 0) + amount } };
  const rank = rankOf(next, jobId);
  return { unit: next, rank, rankUp: rank > before };
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

/** A fresh level-1 unit at full HP and MP with no JP. */
export function createUnit(spec: NewUnit): Unit {
  const unit: Unit = { ...spec, level: 1, jp: { [spec.job]: 0 }, hp: 0, mp: 0, ct: 0, resolve: 0, statuses: [] };
  const stats = effectiveStats(unit);
  return { ...unit, hp: stats.hp, mp: stats.mp };
}
