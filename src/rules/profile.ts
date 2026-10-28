import { JOBS } from '../data/jobs';
import { RELICS, type Relic } from '../data/relics';
import { SHRINES } from '../data/shrines';
import { availableJobs } from './jobs';
import { node, type RunState } from './run';

// Meta progression between runs (docs/DESIGN.md §6.7; decision 0024). The
// profile only widens options: more starting jobs, Codex entries, starting
// relics and shrine events. Pure data; src/profile.ts stores it.

export const PROFILE_VERSION = 1;

/** New profiles draft from these; mastering another base job in any run adds it. */
export const FIRST_JOBS = ['squire', 'archer', 'acolyte'];

export type Profile = {
  version: number;
  /** Base jobs the draft may pick. */
  startingJobs: string[];
  /** Jobs ever held or unlocked by a unit: their Codex entries are open. */
  seenJobs: string[];
  /** Jobs ever mastered (every ability learned). */
  masteredJobs: string[];
  /** Boss node ids ever beaten. */
  bossesBeaten: string[];
  /** Furthest act reached. */
  maxAct: number;
  runs: number;
  wins: number;
};

export function newProfile(): Profile {
  return { version: PROFILE_VERSION, startingJobs: [...FIRST_JOBS], seenJobs: [...FIRST_JOBS], masteredJobs: [], bossesBeaten: [], maxAct: 1, runs: 0, wins: 0 };
}

const union = (a: string[], b: Iterable<string>) => [...new Set([...a, ...b])];

/**
 * Folds a run's progress into the profile. Safe to call after every step of a
 * run (it only adds); `finished` also counts the run and any win, so pass it
 * once, when the run ends.
 */
export function recordRun(profile: Profile, run: RunState, finished = false): Profile {
  const seen = union(run.seenJobs, run.squad.flatMap((u) => availableJobs(u).map((j) => j.id)));
  const mastered = union(profile.masteredJobs, run.masteredJobs);
  const act = run.at ? node(run, run.at).act : 1;
  return {
    ...profile,
    startingJobs: union(profile.startingJobs, mastered.filter((id) => JOBS[id]?.tier === 1)),
    seenJobs: union(profile.seenJobs, seen),
    masteredJobs: mastered,
    bossesBeaten: union(profile.bossesBeaten, run.bossesBeaten),
    maxAct: Math.max(profile.maxAct, act),
    runs: profile.runs + (finished ? 1 : 0),
    wins: profile.wins + (finished && run.status === 'won' ? 1 : 0),
  };
}

export function relicUnlocked(profile: Profile, relic: Relic): boolean {
  const u = relic.unlock;
  if (!u) return true;
  switch (u.kind) {
    case 'runs':
      return profile.runs >= Number(u.value ?? 1);
    case 'wins':
      return profile.wins >= Number(u.value ?? 1);
    case 'boss':
      return profile.bossesBeaten.includes(String(u.value));
    case 'act':
      return profile.maxAct >= Number(u.value);
    case 'advanced-mastery':
      return profile.masteredJobs.some((id) => (JOBS[id]?.tier ?? 0) > 1);
  }
}

export const unlockedRelics = (profile: Profile): Relic[] => RELICS.filter((r) => relicUnlocked(profile, r));

/** Shrine events a run may draw: the base set plus whatever the profile has opened. */
export function shrinePool(profile: Profile): string[] {
  return SHRINES.filter((s) => !s.unlock || (s.unlock === 'first-run' && profile.runs > 0) || (s.unlock === 'first-win' && profile.wins > 0)).map((s) => s.id);
}

/** Human-readable lines for what `after` has that `before` didn't, for the results screen. */
export function newUnlocks(before: Profile, after: Profile): string[] {
  const lines: string[] = [];
  for (const id of after.startingJobs) if (!before.startingJobs.includes(id)) lines.push(`${JOBS[id]!.name} can now be drafted`);
  for (const id of after.seenJobs) if (!before.seenJobs.includes(id)) lines.push(`Codex: ${JOBS[id]?.name ?? id}`);
  for (const r of RELICS) if (relicUnlocked(after, r) && !relicUnlocked(before, r)) lines.push(`Relic: ${r.name}`);
  const shrines = shrinePool(after).filter((id) => !shrinePool(before).includes(id));
  for (const id of shrines) lines.push(`Shrine: ${SHRINES.find((s) => s.id === id)!.title}`);
  return lines;
}
