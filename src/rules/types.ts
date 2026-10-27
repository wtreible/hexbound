// Core game types (docs/DESIGN.md §8). Everything here is a plain serializable
// object so it can be diffed, sent over the network and saved.

export type Pos = { x: number; y: number };

/** 0 = north (-y), 1 = east (+x), 2 = south (+y), 3 = west (-x). */
export type Facing = 0 | 1 | 2 | 3;

export type Stat = 'hp' | 'mp' | 'atk' | 'mag' | 'def' | 'res' | 'spd' | 'move' | 'jump' | 'evade';

export type TerrainId = 'grass' | 'dirt' | 'stone' | 'water';

export type Tile = {
  /** Height in tiers; one tier is half a tile tall. */
  height: number;
  terrain: TerrainId;
  walkable: boolean;
};

/** Row-major: tile (x, y) is tiles[y * width + x]. */
export type Grid = { width: number; depth: number; tiles: Tile[] };

export type JobId = string;
export type AbilityId = string;
export type StatusId = 'guard' | 'pinned' | 'slow' | 'haste' | 'veil' | 'poison' | 'blind' | 'silence' | 'regen';
/** Things left on tiles: oil (fuel for Ignite), fire (burns at turn start), trap and mine (trigger on entry). */
export type HazardId = 'oil' | 'fire' | 'trap' | 'mine';
export type Element = 'fire' | 'ice' | 'lightning' | 'holy' | 'dark';
export type EquipTag = string;
export type GearSlot = 'weapon' | 'armor' | 'accessory';

export type JobDef = {
  id: JobId;
  name: string;
  tier: 1 | 2 | 3;
  /** [] for base jobs, two for hybrids, [hybrid, base] for prestige. */
  requires: JobId[];
  /** Multipliers applied to the unit's base stats. */
  statMods: Partial<Record<Stat, number>>;
  move: number;
  jump: number;
  growth: Partial<Record<Stat, number>>;
  /** The job's basic attack, always available. */
  attack: AbilityId;
  /** Each ability unlocks at the given rank in this job (0 = from the start). */
  actionSet: { abilityId: AbilityId; rank: 0 | 1 | 2 | 3 }[];
  /** Learned at Rank 2; equippable on any job afterwards. */
  passives: AbilityId[];
  /** Granted on mastery; equippable on any job afterwards. */
  ultimate: AbilityId;
  equip: EquipTag[];
  /** Key into the asset manifest. */
  model: string;
};

export type AreaShape = 'single' | 'cross' | 'diamond' | 'line' | 'cone';

export type Effect =
  | {
      type: 'damage';
      stat: 'atk' | 'mag';
      power: number;
      element?: Element;
      /** Multiplies the facing damage bonus (Backstab). */
      facingMultiplier?: number;
      /** Always counts as an attack from this side (Shadow Step). */
      forceSide?: 'back';
    }
  /** Heals mag * power + flat + pct of the target's max HP. */
  | { type: 'heal'; power?: number; flat?: number; pct?: number }
  | { type: 'status'; status: StatusId; chance: number; duration: number }
  | { type: 'push'; distance: number }
  | { type: 'revive'; hpPct: number }
  | { type: 'cleanse' }
  /** Restores MP to the target; with steal, takes it from the target and gives it to the caster. */
  | { type: 'mp'; amount: number; steal?: boolean }
  | { type: 'ct'; delta: number }
  /** Leaves a hazard on each walkable tile in the area. Traps and mines only go on empty tiles. */
  | { type: 'hazard'; hazard: HazardId; rounds: number };

/** Passive abilities (docs/DESIGN.md §6.1): supports and reactions. */
export type PassiveEffect =
  | { type: 'stat'; stat: Stat; add: number }
  | { type: 'range'; tag: string; add: number }
  | { type: 'heal-boost'; pct: number }
  | { type: 'mp-regen'; amount: number }
  | { type: 'mp-on-hit'; amount: number }
  /** Strike back with the basic attack when hit in melee. */
  | { type: 'counter' }
  /** Take single-target hostile abilities aimed at an adjacent ally. */
  | { type: 'cover' };

/** What sets off a cross-player combo (docs/DESIGN.md §6.6). */
export type ComboTrigger = { type: 'element-on-hazard'; element: Element; hazard: HazardId; crossPlayer: boolean };

export type AbilityDef = {
  id: AbilityId;
  name: string;
  kind: 'action' | 'passive' | 'ultimate' | 'combo';
  cost?: { mp?: number; item?: string; resolve?: number };
  /** Horizontal (Manhattan) distance. heightBonus: +1 max range per 2 tiers above the target. */
  range: { min: number; max: number; los: boolean; heightBonus?: boolean };
  area: { shape: AreaShape; size: number };
  /** >0 = delayed, targets tiles. Not resolved until M5. */
  chargeTicks?: number;
  /** Resolved in order against every unit in the area. */
  effects: Effect[];
  /** Which units in the area are affected. Default 'all' (friendly fire). */
  affects?: 'all' | 'foes' | 'allies';
  /** For kind 'passive'. */
  passive?: PassiveEffect[];
  /** For kind 'combo'. */
  trigger?: ComboTrigger;
  /** 'physical' or 'magic' decides defence and hit chance; 'bow', 'throw', 'melee' match range passives. */
  tags: string[];
  description: string;
};

export type Hazard = { id: HazardId; pos: Pos; rounds: number; ownerId: string };

export type Unit = {
  id: string;
  /** Player slot ('p1'...'p4') or 'enemy' for AI-controlled units. */
  ownerId: string;
  name: string;
  level: number;
  job: JobId;
  /** Base stats before job multipliers. base.move and base.jump add to the job's values. */
  base: Record<Stat, number>;
  /** Cumulative JP earned in each job; rank comes from this (rules/jobs.ts). */
  jp: Record<JobId, number>;
  /** Action set borrowed from another job the unit has reached Rank 1 in. */
  secondary?: JobId;
  passive?: AbilityId;
  ultimate?: AbilityId;
  /** Equipped item ids by slot (src/data/items.ts). */
  gear?: Partial<Record<GearSlot, string>>;
  hp: number;
  mp: number;
  ct: number;
  /** 0-100; fills as the unit deals and takes damage. Ultimates spend it. */
  resolve: number;
  pos: Pos;
  facing: Facing;
  statuses: { id: StatusId; turns: number }[];
  /**
   * Set while downed (0 HP): full rounds left to revive the unit. Counts down
   * as each round starts; a round that starts at 0 makes it a grave.
   */
  downedRounds?: number;
  /** Permanently lost; left on the board as a grave marker. */
  dead?: boolean;
  /** Left the battlefield through an exit (Escape objective): safe, but out of the fight. */
  escaped?: boolean;
};

export type ActiveUnit = { unitId: string; moved: boolean; acted: boolean };

export type TurnState =
  | { phase: 'player' | 'enemy'; active: ActiveUnit[] }
  | { phase: 'over'; winner: 'player' | 'enemy' };

/**
 * A round ends once every unit that was standing when it began has taken a
 * turn (or gone down). Downed counters and hazards run on rounds.
 */
export type RoundState = { n: number; waiting: string[] };

/** What a battle is won by (docs/DESIGN.md §5.2). Every objective is also won by routing the enemy. */
export type Objective =
  | { type: 'rout' }
  | { type: 'leader'; unitId: string }
  | { type: 'escort'; unitId: string; exits: Pos[] }
  | { type: 'hold'; tiles: Pos[]; rounds: number; held: number }
  | { type: 'escape'; exits: Pos[] };

/** A charge-time ability waiting to resolve on its tiles (docs/DESIGN.md §5.3). */
export type Cast = { casterId: string; abilityId: AbilityId; from: Pos; target: Pos; tiles: Pos[]; ticks: number };

export type GameState = {
  grid: Grid;
  objective: Objective;
  casts: Cast[];
  units: Unit[];
  turn: TurnState;
  hazards: Hazard[];
  round: RoundState;
  /** The party's shared consumables, by item id; used up in battle. */
  inventory: Record<string, number>;
  /** Items looted from graves this battle; they join the stash afterwards. */
  loot: string[];
};

export type Intent =
  | { type: 'move'; unitId: string; to: Pos }
  | { type: 'act'; unitId: string; abilityId: AbilityId; target: Pos }
  | { type: 'face'; unitId: string; facing: Facing }
  | { type: 'wait'; unitId: string };

export type GameEvent =
  | { type: 'moved'; unitId: string; path: Pos[] }
  | { type: 'faced'; unitId: string; facing: Facing }
  | { type: 'acted'; unitId: string; abilityId: AbilityId; target: Pos }
  | { type: 'damaged'; unitId: string; amount: number; source?: 'poison' | 'fire' | HazardId }
  | { type: 'missed'; unitId: string }
  | { type: 'healed'; unitId: string; amount: number }
  | { type: 'status'; unitId: string; status: StatusId; added: boolean }
  | { type: 'pushed'; unitId: string; from: Pos; to: Pos }
  | { type: 'downed'; unitId: string }
  | { type: 'revived'; unitId: string }
  | { type: 'down-tick'; unitId: string; roundsLeft: number }
  | { type: 'died'; unitId: string }
  | { type: 'turn-ended'; unitId: string }
  | { type: 'mp'; unitId: string; amount: number }
  | { type: 'ct'; unitId: string; delta: number }
  | { type: 'hazard'; hazard: HazardId; pos: Pos; added: boolean }
  /** A unit walked onto a hostile trap or mine and stopped there. */
  | { type: 'triggered'; unitId: string; hazard: HazardId; pos: Pos }
  | { type: 'countered'; unitId: string; targetId: string }
  | { type: 'covered'; unitId: string; forId: string }
  | { type: 'combo'; comboId: string; pos: Pos }
  | { type: 'jp'; unitId: string; job: JobId; amount: number; rank: number; rankUp: boolean }
  | { type: 'round'; n: number }
  | { type: 'cast'; unitId: string; abilityId: AbilityId; tiles: Pos[]; ticks: number }
  | { type: 'cast-resolved'; unitId: string; abilityId: AbilityId }
  | { type: 'cast-fizzled'; unitId: string; abilityId: AbilityId }
  | { type: 'escaped'; unitId: string }
  | { type: 'held'; held: number; rounds: number }
  | { type: 'looted'; unitId: string; itemId: string }
  | { type: 'phase'; phase: 'player' | 'enemy'; unitIds: string[] }
  | { type: 'battle-over'; winner: 'player' | 'enemy' };
