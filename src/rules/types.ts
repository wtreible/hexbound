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
export type StatusId = 'guard' | 'pinned';
export type Element = 'fire' | 'ice' | 'lightning' | 'holy' | 'dark';
export type EquipTag = string;

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
  actionSet: { abilityId: AbilityId; rank: 0 | 1 | 2 | 3 }[];
  passives: AbilityId[];
  ultimate?: AbilityId;
  equip: EquipTag[];
  /** Key into the asset manifest. */
  model: string;
};

export type AreaShape = 'single' | 'cross' | 'diamond' | 'line' | 'cone';

export type Effect =
  | { type: 'damage'; stat: 'atk' | 'mag'; power: number; element?: Element }
  | { type: 'heal'; stat: 'mag'; power: number }
  | { type: 'status'; status: StatusId; chance: number; duration: number }
  | { type: 'push'; distance: number }
  | { type: 'revive'; hpPct: number }
  | { type: 'cleanse' };

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
  /** 'physical' or 'magic' decides defence and hit chance; others are flavour. */
  tags: string[];
  description: string;
};

export type Unit = {
  id: string;
  /** Player slot ('p1'...'p4') or 'enemy' for AI-controlled units. */
  ownerId: string;
  name: string;
  level: number;
  job: JobId;
  /** Base stats before job multipliers. base.move and base.jump add to the job's values. */
  base: Record<Stat, number>;
  hp: number;
  mp: number;
  ct: number;
  pos: Pos;
  facing: Facing;
  statuses: { id: StatusId; turns: number }[];
  /** Set while downed (0 HP); counts down on each of the unit's would-be turns. */
  downedTurns?: number;
  /** Permanently lost; left on the board as a grave marker. */
  dead?: boolean;
};

export type ActiveUnit = { unitId: string; moved: boolean; acted: boolean };

export type TurnState =
  | { phase: 'player' | 'enemy'; active: ActiveUnit[] }
  | { phase: 'over'; winner: 'player' | 'enemy' };

export type GameState = { grid: Grid; units: Unit[]; turn: TurnState };

export type Intent =
  | { type: 'move'; unitId: string; to: Pos }
  | { type: 'act'; unitId: string; abilityId: AbilityId; target: Pos }
  | { type: 'face'; unitId: string; facing: Facing }
  | { type: 'wait'; unitId: string };

export type GameEvent =
  | { type: 'moved'; unitId: string; path: Pos[] }
  | { type: 'faced'; unitId: string; facing: Facing }
  | { type: 'acted'; unitId: string; abilityId: AbilityId; target: Pos }
  | { type: 'damaged'; unitId: string; amount: number }
  | { type: 'missed'; unitId: string }
  | { type: 'healed'; unitId: string; amount: number }
  | { type: 'status'; unitId: string; status: StatusId; added: boolean }
  | { type: 'pushed'; unitId: string; from: Pos; to: Pos }
  | { type: 'downed'; unitId: string }
  | { type: 'revived'; unitId: string }
  | { type: 'down-tick'; unitId: string; turnsLeft: number }
  | { type: 'died'; unitId: string }
  | { type: 'turn-ended'; unitId: string }
  | { type: 'phase'; phase: 'player' | 'enemy'; unitIds: string[] }
  | { type: 'battle-over'; winner: 'player' | 'enemy' };
