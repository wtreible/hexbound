import type { EnemySpec, ObjectiveType } from '../rules/battle';

// Enemy groups for the run (docs/DESIGN.md §5.1). Levels are set by act; elites
// add a level and a unit; each act ends with a boss (decision 0015). Objectives
// are in decision 0017.

export type EncounterKind = 'battle' | 'elite' | 'boss';

export type Encounter = {
  id: string;
  name: string;
  act: 1 | 2 | 3;
  kind: EncounterKind;
  /** Default 'rout'. Bosses are 'leader' fights against the first enemy. */
  objective?: ObjectiveType;
  /** Bosses list the boss first. */
  enemies: EnemySpec[];
};

/** Enemy level for each act's normal battles. The squad gains about a level per battle won. */
export const ACT_LEVEL: Record<1 | 2 | 3, number> = { 1: 1, 2: 4, 3: 7 };
export const ELITE_LEVELS = 1;
export const BOSS_LEVELS = 2;
/** Bosses are much tougher than a unit of their level. */
export const BOSS_SCALE = { hp: 2.5, atk: 1.15, mag: 1.15, def: 1.1, res: 1.1 } as const;

const e = (name: string, job: string): EnemySpec => ({ name, job });
const boss = (name: string, job: string): EnemySpec => ({ name, job, scale: BOSS_SCALE });

export const ENCOUNTERS: Encounter[] = [
  // --- Act 1: the old road ---
  { id: 'bandits', name: 'Bandits', act: 1, kind: 'battle', enemies: [e('Bandit', 'squire'), e('Bandit', 'squire'), e('Poacher', 'archer')] },
  { id: 'poachers', name: 'Poachers', act: 1, kind: 'battle', objective: 'escort', enemies: [e('Poacher', 'archer'), e('Poacher', 'archer'), e('Cutpurse', 'thief')] },
  { id: 'highwaymen', name: 'Highwaymen', act: 1, kind: 'battle', objective: 'hold', enemies: [e('Cutpurse', 'thief'), e('Bandit', 'squire'), e('Poacher', 'archer')] },
  { id: 'bandit-crew', name: 'Bandit Crew', act: 1, kind: 'elite', enemies: [e('Bandit', 'squire'), e('Bandit', 'squire'), e('Poacher', 'archer'), e('Quack', 'chemist')] },
  {
    id: 'bandit-chief', name: 'The Bandit Chief', act: 1, kind: 'boss', objective: 'leader',
    enemies: [boss('Bandit Chief', 'squire'), e('Poacher', 'archer'), e('Cutpurse', 'thief')],
  },

  // --- Act 2: the drowned chapel ---
  { id: 'cultists', name: 'Cultists', act: 2, kind: 'battle', enemies: [e('Cultist', 'mage'), e('Cultist', 'acolyte'), e('Zealot', 'squire'), e('Zealot', 'squire')] },
  { id: 'raiders', name: 'Raiders', act: 2, kind: 'battle', objective: 'escape', enemies: [e('Raider', 'squire'), e('Raider', 'thief'), e('Raider', 'thief'), e('Slinger', 'archer')] },
  { id: 'hedge-witches', name: 'Hedge Witches', act: 2, kind: 'battle', objective: 'leader', enemies: [e('Witch', 'mage'), e('Witch', 'mage'), e('Herbalist', 'chemist'), e('Zealot', 'squire')] },
  { id: 'chapel-guard', name: 'Chapel Guard', act: 2, kind: 'elite', enemies: [e('Templar', 'paladin'), e('Cultist', 'mage'), e('Cultist', 'acolyte'), e('Zealot', 'squire'), e('Slinger', 'archer')] },
  {
    id: 'grave-warden', name: 'The Grave Warden', act: 2, kind: 'boss', objective: 'leader',
    enemies: [boss('Grave Warden', 'paladin'), e('Cultist', 'mage'), e('Cultist', 'acolyte'), e('Slinger', 'archer')],
  },

  // --- Act 3: the hexbound keep ---
  { id: 'keep-watch', name: 'Keep Watch', act: 3, kind: 'battle', enemies: [e('Warden', 'ranger'), e('Warden', 'ranger'), e('Blade', 'spellblade'), e('Sister', 'acolyte')] },
  { id: 'saboteurs', name: 'Saboteurs', act: 3, kind: 'battle', objective: 'hold', enemies: [e('Sapper', 'saboteur'), e('Sapper', 'saboteur'), e('Blade', 'spellblade'), e('Seer', 'oracle')] },
  { id: 'hex-knights', name: 'Hex Knights', act: 3, kind: 'battle', objective: 'escort', enemies: [e('Hex Knight', 'paladin'), e('Hex Knight', 'spellblade'), e('Seer', 'oracle'), e('Warden', 'ranger')] },
  { id: 'inner-circle', name: 'Inner Circle', act: 3, kind: 'elite', enemies: [e('Hex Knight', 'paladin'), e('Blade', 'spellblade'), e('Seer', 'oracle'), e('Sapper', 'saboteur'), e('Warden', 'ranger')] },
  {
    id: 'hexbinder', name: 'The Hexbinder', act: 3, kind: 'boss', objective: 'leader',
    enemies: [boss('The Hexbinder', 'oracle'), e('Hex Knight', 'spellblade'), e('Hex Knight', 'paladin'), e('Warden', 'ranger'), e('Sapper', 'saboteur')],
  },
];
