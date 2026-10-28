import { ABILITIES } from '../data/abilities';
import { ITEMS } from '../data/items';
import { JOBS } from '../data/jobs';
import type { AbilityDef, Facing, JobDef, JobId, PassiveEffect, PassiveSlot, Pos, Stat, Unit } from './types';

// Jobs and progression, FFT-style (docs/DESIGN.md §6; decision 0023):
// abilities are learned one at a time by spending a job's JP; job level comes
// from total JP earned in that job; advanced jobs need levels in earlier ones.
// A unit equips a primary job, a secondary job's learned actions, one
// reaction, one support, one movement and one ultimate.

/** Total JP needed for job levels 2, 3, ... 8 (level 1 is free). */
export const JOB_LEVEL_JP = [100, 250, 450, 700, 1000, 1400, 1900] as const;
export const MAX_JOB_LEVEL = JOB_LEVEL_JP.length + 1;

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

export function levelForJp(total: number): number {
  return 1 + JOB_LEVEL_JP.filter((t) => total >= t).length;
}

export const jobLevel = (unit: Unit, jobId: JobId): number => levelForJp(unit.jpTotal[jobId] ?? 0);

export const knows = (unit: Unit, abilityId: string): boolean => unit.learned.includes(abilityId);

/** A job is mastered once every ability in it is learned. */
export const isMastered = (unit: Unit, jobId: JobId): boolean => job(jobId).abilities.every((a) => knows(unit, a.abilityId));

/** Effects of the equipped reaction, support and movement. */
export function passiveEffects(unit: Unit): PassiveEffect[] {
  return [unit.reaction, unit.support, unit.movement].flatMap((id) => (id ? (ability(id).passive ?? []) : []));
}

export const hasPassive = (unit: Unit, type: PassiveEffect['type']): boolean => passiveEffects(unit).some((p) => p.type === type);

const MULTIPLIED: Stat[] = ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd', 'evade'];

/** Stats after job multipliers, passives, gear and statuses. */
export function effectiveStats(unit: Unit): Record<Stat, number> {
  const j = jobOf(unit);
  const s = { ...unit.base };
  for (const stat of MULTIPLIED) s[stat] = Math.round(unit.base[stat] * (j.statMods[stat] ?? 1));
  s.move = j.move + unit.base.move;
  s.jump = j.jump + unit.base.jump;
  for (const p of passiveEffects(unit)) if (p.type === 'stat') s[p.stat] += p.add;
  for (const id of Object.values(unit.gear ?? {})) {
    for (const [stat, add] of Object.entries((id && ITEMS[id]?.stats) || {})) s[stat as Stat] += add;
  }
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
export type AbilityEntry = { ability: AbilityDef; source: AbilitySource };

const learnedActions = (unit: Unit, jobId: JobId): AbilityDef[] =>
  job(jobId)
    .abilities.map((a) => ability(a.abilityId))
    .filter((a) => a.kind === 'action' && knows(unit, a.id));

/**
 * Everything on the unit's command list: basic attack, the primary job's
 * learned actions, the secondary job's learned actions, and the ultimate.
 */
export function abilityEntries(unit: Unit): AbilityEntry[] {
  const entries: AbilityEntry[] = [{ ability: ability(jobOf(unit).attack), source: 'attack' }];
  for (const a of learnedActions(unit, unit.job)) entries.push({ ability: a, source: 'primary' });
  if (unit.secondary) for (const a of learnedActions(unit, unit.secondary)) entries.push({ ability: a, source: 'secondary' });
  if (unit.ultimate) entries.push({ ability: ability(unit.ultimate), source: 'ultimate' });
  return entries;
}

/** Abilities the unit may use right now, ignoring cost. */
export function abilitiesOf(unit: Unit): AbilityDef[] {
  return abilityEntries(unit).map((e) => e.ability);
}

export function canAfford(unit: Unit, a: AbilityDef): boolean {
  return (a.cost?.mp ?? 0) <= unit.mp && (a.cost?.resolve ?? 0) <= unit.resolve;
}

export const isSilenced = (unit: Unit): boolean => unit.statuses.some((s) => s.id === 'silence');

/** Affordable, and not magic while silenced. */
export function canUse(unit: Unit, a: AbilityDef): boolean {
  return canAfford(unit, a) && !(isSilenced(unit) && a.tags.includes('magic'));
}

// --- Progression and loadout (changed only at camp) ---

/** Jobs whose requirements the unit meets: starting jobs always, others by job levels. */
export function availableJobs(unit: Unit): JobDef[] {
  return Object.values(JOBS).filter((j) => j.tier > 0 && j.requires.every((r) => jobLevel(unit, r.job) >= r.level));
}

/** What a job still needs, e.g. "Squire Lv 3, Acolyte Lv 2", or '' when unlocked. */
export function missingRequirements(unit: Unit, jobId: JobId): string {
  return job(jobId)
    .requires.filter((r) => jobLevel(unit, r.job) < r.level)
    .map((r) => `${job(r.job).name} Lv ${r.level}`)
    .join(', ');
}

/** Jobs whose learned actions can be borrowed as the secondary. */
export function secondaryOptions(unit: Unit, primary: JobId = unit.job): JobDef[] {
  return Object.values(JOBS).filter((j) => j.tier > 0 && j.id !== primary && learnedActions(unit, j.id).length > 0);
}

/** Learned abilities that fit a slot. */
export function slotOptions(unit: Unit, slot: PassiveSlot | 'ultimate'): AbilityDef[] {
  return unit.learned.map(ability).filter((a) => a.kind === slot);
}

export type Loadout = { job: JobId; secondary?: JobId; reaction?: string; support?: string; movement?: string; ultimate?: string };

/** Applies a camp loadout, rejecting anything the unit can't use. MP refills to the new maximum. */
export function setLoadout(unit: Unit, loadout: Loadout): Unit | { error: string } {
  if (!availableJobs(unit).some((j) => j.id === loadout.job)) return { error: `${job(loadout.job).name} is locked: needs ${missingRequirements(unit, loadout.job)}` };
  if (loadout.secondary && !secondaryOptions(unit, loadout.job).some((j) => j.id === loadout.secondary)) {
    return { error: `can't use ${loadout.secondary} as a secondary` };
  }
  for (const slot of ['reaction', 'support', 'movement', 'ultimate'] as const) {
    const id = loadout[slot];
    if (id && !slotOptions(unit, slot).some((a) => a.id === id)) return { error: `${id} isn't a learned ${slot}` };
  }
  const { secondary: _s, reaction: _r, support: _p, movement: _m, ultimate: _u, ...rest } = unit;
  const next: Unit = { ...rest, job: loadout.job, jp: { [loadout.job]: 0, ...unit.jp }, jpTotal: { [loadout.job]: 0, ...unit.jpTotal } };
  for (const slot of ['secondary', 'reaction', 'support', 'movement', 'ultimate'] as const) if (loadout[slot]) next[slot] = loadout[slot];
  const stats = effectiveStats(next);
  return { ...next, hp: Math.min(stats.hp, Math.max(1, unit.hp)), mp: stats.mp };
}

/** The JP price of an ability in a job, or null if that job doesn't teach it. */
export function priceIn(jobId: JobId, abilityId: string): number | null {
  return job(jobId).abilities.find((a) => a.abilityId === abilityId)?.jp ?? null;
}

/** Spends a job's JP to learn one of its abilities (camp only). */
export function learn(unit: Unit, jobId: JobId, abilityId: string): Unit | { error: string } {
  const price = priceIn(jobId, abilityId);
  if (price === null) return { error: `${job(jobId).name} doesn't teach ${abilityId}` };
  if (knows(unit, abilityId)) return { error: 'already learned' };
  if ((unit.jp[jobId] ?? 0) < price) return { error: `needs ${price} ${job(jobId).name} JP` };
  return { ...unit, learned: [...unit.learned, abilityId], jp: { ...unit.jp, [jobId]: (unit.jp[jobId] ?? 0) - price } };
}

export type JpGain = { unit: Unit; amount: number; level: number; levelUp: boolean };

/** Adds JP to a job (the current one by default), boosted by JP Boost, and reports any job level-up. */
export function grantJp(unit: Unit, amount: number, jobId: JobId = unit.job): JpGain {
  let boost = 1;
  for (const p of passiveEffects(unit)) if (p.type === 'jp-boost') boost += p.pct;
  const gained = Math.round(amount * boost);
  const before = jobLevel(unit, jobId);
  const next: Unit = {
    ...unit,
    jp: { ...unit.jp, [jobId]: (unit.jp[jobId] ?? 0) + gained },
    jpTotal: { ...unit.jpTotal, [jobId]: (unit.jpTotal[jobId] ?? 0) + gained },
  };
  const level = jobLevel(next, jobId);
  return { unit: next, amount: gained, level, levelUp: level > before };
}

/**
 * Gains one character level in the current job: base stats grow by its growth
 * table (docs/DESIGN.md §5.4). Current HP and MP rise by however much their maximums did.
 */
export function levelUp(unit: Unit): Unit {
  const base = { ...unit.base };
  for (const [stat, add] of Object.entries(jobOf(unit).growth)) base[stat as Stat] += add;
  const before = effectiveStats(unit);
  const next: Unit = { ...unit, level: unit.level + 1, base };
  const after = effectiveStats(next);
  return { ...next, hp: unit.hp + Math.max(0, after.hp - before.hp), mp: unit.mp + Math.max(0, after.mp - before.mp) };
}

export type NewUnit = {
  id: string;
  ownerId: string;
  name: string;
  job: string;
  base: Record<Stat, number>;
  pos: Pos;
  facing: Facing;
  /** Starting level, grown in the starting job. Default 1. */
  level?: number;
  /** Abilities known from the start. Default: the job's first action. */
  learned?: string[];
};

/** The first action a job teaches: new units start knowing it so they have something to use. */
export function starterAbility(jobId: JobId): string | undefined {
  return job(jobId).abilities.map((a) => ability(a.abilityId)).find((a) => a.kind === 'action')?.id;
}

/** A fresh unit at full HP and MP with no JP. */
export function createUnit(spec: NewUnit): Unit {
  const { level = 1, learned, ...rest } = spec;
  const starter = starterAbility(spec.job);
  let unit: Unit = {
    ...rest,
    level: 1,
    jp: { [spec.job]: 0 },
    jpTotal: { [spec.job]: 0 },
    learned: learned ?? (starter ? [starter] : []),
    hp: 0,
    mp: 0,
    ct: 0,
    resolve: 0,
    statuses: [],
  };
  for (let l = 1; l < level; l++) unit = levelUp(unit);
  const stats = effectiveStats(unit);
  return { ...unit, hp: stats.hp, mp: stats.mp };
}

/** What an enemy of a job knows at a level: every action priced within reach of that level, plus its passives. */
export function enemyKnowledge(jobId: JobId, level: number): Pick<Unit, 'learned' | 'reaction' | 'support' | 'movement'> {
  const budget = job(jobId).tier === 0 ? Infinity : 50 + level * 50;
  const learned = job(jobId)
    .abilities.filter((a) => a.jp <= budget && ability(a.abilityId).kind !== 'ultimate')
    .map((a) => a.abilityId);
  const out: Pick<Unit, 'learned' | 'reaction' | 'support' | 'movement'> = { learned };
  for (const slot of ['reaction', 'support', 'movement'] as const) {
    const id = learned.find((a) => ability(a).kind === slot);
    if (id) out[slot] = id;
  }
  return out;
}
