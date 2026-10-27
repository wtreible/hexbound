import { ACT_LEVEL, BOSS_LEVELS, ELITE_LEVELS, ENCOUNTERS, type Encounter } from '../data/encounters';
import { ITEMS } from '../data/items';
import { JOBS } from '../data/jobs';
import { BATTLE_MAPS } from '../data/maps';
import { SHRINES, type ShrineChoice } from '../data/shrines';
import { UNIT_NAMES } from '../data/units';
import { newSquad, survivors, type BattleSetup } from './battle';
import { canEquip, item } from './items';
import { createUnit, effectiveStats, grantJp, levelUp, setLoadout, type Loadout } from './jobs';
import { createRng, type Rng } from './rng';
import type { GameState, GearSlot, Stat, Unit } from './types';

// The run (docs/DESIGN.md §5.1): a seeded branching map of 3 acts, each ending
// in a boss. Pure state transitions; saving and screens live outside rules.

/** Bump when RunState changes shape; older saves are discarded (§11). */
export const RUN_VERSION = 2;
export const ACTS = 3;
/** Choice rows per act before the boss, so a run visits 3 x (3 + 1) = 12 nodes. */
export const CHOICE_ROWS = 3;
export const RECRUIT_OFFERS = 3;
export const REST_HEAL_PCT = 0.5;
export const START_GOLD = 50;
export const START_INVENTORY: Record<string, number> = { potion: 2 };
/** Gold per battle won, multiplied by the act. */
export const GOLD_REWARD = { battle: 25, elite: 45, boss: 80 } as const;
export const SHOP_GEAR = 4;
/** Consumables every shop sells. */
export const SHOP_CONSUMABLES = ['potion', 'ether', 'antidote', 'phoenix-feather'];

export type NodeType = 'battle' | 'elite' | 'camp' | 'recruit' | 'shop' | 'shrine' | 'boss';
export type Act = 1 | 2 | 3;

export type RunNode = { id: string; act: Act; row: number; col: number; type: NodeType; next: string[] };

export type RunState = {
  version: number;
  seed: number;
  /** Run-level RNG state (map, recruits); battles use their own seed per node. */
  rng: number;
  nodes: RunNode[];
  /** The node the party is at, or null before the first choice. */
  at: string | null;
  visited: string[];
  squad: Unit[];
  /** Units lost for good, for the results screen. */
  fallen: { name: string; job: string; level: number }[];
  battlesWon: number;
  squadSize: number;
  nextUnitId: number;
  gold: number;
  /** Shared consumables by item id. */
  inventory: Record<string, number>;
  /** Unequipped gear item ids. */
  stash: string[];
  status: 'map' | 'node' | 'won' | 'lost';
  /** State for the node being visited. */
  camp?: { rested: boolean };
  recruits?: Unit[];
  shop?: { gear: string[] };
  shrine?: { eventId: string; result?: string };
};

const NODE_WEIGHTS: [NodeType, number][] = [
  ['battle', 46],
  ['elite', 14],
  ['camp', 12],
  ['recruit', 10],
  ['shop', 9],
  ['shrine', 9],
];

function weighted<T>(rng: Rng, options: [T, number][]): T {
  const total = options.reduce((n, [, w]) => n + w, 0);
  let roll = rng.next() * total;
  for (const [value, w] of options) {
    roll -= w;
    if (roll < 0) return value;
  }
  return options[options.length - 1]![0];
}

function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[rng.int(0, items.length - 1)]!;
}

/** Links each node in `from` to the nearest one or two in `to`, making sure every `to` node is reachable. */
function connect(rng: Rng, from: RunNode[], to: RunNode[]) {
  if (!from.length) return; // the run's first row: entered directly
  const nearest = (i: number, a: number, b: number) => Math.min(b - 1, Math.floor(((i + 0.5) / a) * b));
  from.forEach((f, i) => {
    const j = nearest(i, from.length, to.length);
    f.next.push(to[j]!.id);
    const side = j + (rng.next() < 0.5 ? -1 : 1);
    if (to[side] && rng.next() < 0.5) f.next.push(to[side]!.id);
  });
  to.forEach((t, j) => {
    if (from.some((f) => f.next.includes(t.id))) return;
    from[nearest(j, to.length, from.length)]!.next.push(t.id);
  });
}

export function generateMap(rng: Rng): RunNode[] {
  const nodes: RunNode[] = [];
  let previous: RunNode[] = [];
  for (let act = 1 as Act; act <= ACTS; act = (act + 1) as Act) {
    for (let row = 0; row < CHOICE_ROWS; row++) {
      const count = rng.int(2, 3);
      const current: RunNode[] = [];
      for (let col = 0; col < count; col++) {
        let type: NodeType;
        if (act === 1 && row === 0) type = 'battle'; // ease in
        else if (row === CHOICE_ROWS - 1 && col === 0) type = 'camp'; // always a chance to rest before a boss
        else type = weighted(rng, NODE_WEIGHTS);
        current.push({ id: `${act}-${row}-${col}`, act, row, col, type, next: [] });
      }
      connect(rng, previous, current);
      nodes.push(...current);
      previous = current;
    }
    const boss: RunNode = { id: `${act}-boss`, act, row: CHOICE_ROWS, col: 0, type: 'boss', next: [] };
    connect(rng, previous, [boss]);
    nodes.push(boss);
    previous = [boss];
  }
  return nodes;
}

export type NewRun = {
  seed: number;
  draft: { name: string; job: string; ownerId: string }[];
  base: Record<Stat, number>;
  squadSize: number;
};

export function newRun(opts: NewRun): RunState {
  const rng = createRng(opts.seed);
  const nodes = generateMap(rng);
  const squad = newSquad(opts.draft, opts.base);
  return {
    version: RUN_VERSION,
    seed: opts.seed,
    rng: rng.state(),
    nodes,
    at: null,
    visited: [],
    squad,
    fallen: [],
    battlesWon: 0,
    squadSize: opts.squadSize,
    nextUnitId: squad.length,
    gold: START_GOLD,
    inventory: { ...START_INVENTORY },
    stash: [],
    status: 'map',
  };
}

export function node(run: RunState, id: string): RunNode {
  const n = run.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
}

/** Nodes the party can move to next. */
export function choices(run: RunState): RunNode[] {
  if (run.status !== 'map') return [];
  if (run.at === null) return run.nodes.filter((n) => n.act === 1 && n.row === 0);
  return node(run, run.at).next.map((id) => node(run, id));
}

export const isBattle = (type: NodeType) => type === 'battle' || type === 'elite' || type === 'boss';

export function enterNode(run: RunState, id: string, base: Record<Stat, number>): RunState | { error: string } {
  if (!choices(run).some((n) => n.id === id)) return { error: `can't go to ${id}` };
  const n = node(run, id);
  const next = clearNodeState({ ...run, at: id, visited: [...run.visited, id], status: 'node' });
  if (n.type === 'camp') next.camp = { rested: false };
  if (n.type === 'recruit') return offerRecruits(next, base);
  if (n.type === 'shop') return stockShop(next, n.act);
  if (n.type === 'shrine') return pickShrine(next);
  return next;
}

function clearNodeState(run: RunState): RunState {
  const next = { ...run };
  delete next.camp;
  delete next.recruits;
  delete next.shop;
  delete next.shrine;
  return next;
}

/** Back to the map after a non-battle node. */
export function leaveNode(run: RunState): RunState {
  return clearNodeState({ ...run, status: 'map' });
}

/** FNV-1a: a stable 32-bit hash so each node's battle has its own seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type RunBattle = { setup: BattleSetup; encounter: Encounter; mapName: string; seed: number };

/** The battle at the current node. Deterministic, so a refresh mid-battle replays the same fight. */
export function battleFor(run: RunState, base: Record<Stat, number>): RunBattle {
  const n = node(run, run.at!);
  if (!isBattle(n.type)) throw new Error(`${n.id} is not a battle`);
  const seed = hash(`${run.seed}:${n.id}`);
  const rng = createRng(seed);
  const kind = n.type === 'battle' ? 'battle' : n.type;
  const encounter = pickOne(rng, ENCOUNTERS.filter((e) => e.act === n.act && e.kind === kind));
  const map = pickOne(rng, BATTLE_MAPS);
  const level = ACT_LEVEL[n.act] + (kind === 'elite' ? ELITE_LEVELS : 0) + (kind === 'boss' ? BOSS_LEVELS : 0);
  return {
    setup: {
      rows: map.rows,
      spawns: map.spawns,
      objective: encounter.objective,
      exits: map.exits,
      hold: map.hold,
      vip: map.vip,
      squad: run.squad,
      enemies: encounter.enemies.map((spec) => ({ ...spec, level })),
      base,
      inventory: run.inventory,
    },
    encounter,
    mapName: map.name,
    seed,
  };
}

/**
 * Applies a finished battle. A loss ends the run. A win keeps the survivors
 * (HP carries over, downed units at 1 HP), levels each of them up once,
 * records the dead (their unlooted gear is lost), pays gold, and keeps what
 * was left of the inventory plus any grave loot. Beating the act 3 boss wins the run.
 */
export function finishBattle(run: RunState, final: GameState): RunState {
  if (final.turn.phase !== 'over') throw new Error('battle is not over');
  // The squad only: not enemies, and not an escorted NPC.
  const players = final.units.filter((u) => u.ownerId !== 'enemy' && u.ownerId !== 'npc');
  if (final.turn.winner === 'enemy') {
    const fallen = players.map((u) => ({ name: u.name, job: u.job, level: u.level }));
    return { ...run, squad: [], fallen: [...run.fallen, ...fallen], status: 'lost' };
  }
  const dead = players.filter((u) => u.dead).map((u) => ({ name: u.name, job: u.job, level: u.level }));
  const squad = survivors(final.units).map(levelUp);
  const n = node(run, run.at!);
  const won = n.type === 'boss' && n.act === ACTS;
  const kind = n.type === 'elite' || n.type === 'boss' ? n.type : 'battle';
  return {
    ...run,
    squad,
    fallen: [...run.fallen, ...dead],
    battlesWon: run.battlesWon + 1,
    gold: run.gold + GOLD_REWARD[kind] * n.act,
    inventory: Object.fromEntries(Object.entries(final.inventory).filter(([, count]) => count > 0)),
    stash: [...run.stash, ...final.loot],
    status: won ? 'won' : 'map',
  };
}

/** Battle reward shown before the fight. */
export function goldReward(n: RunNode): number {
  return isBattle(n.type) ? GOLD_REWARD[n.type === 'elite' || n.type === 'boss' ? n.type : 'battle'] * n.act : 0;
}

/** Camp: heal every unit by half its max HP, once per visit. */
export function rest(run: RunState): RunState {
  if (!run.camp || run.camp.rested) return run;
  const squad = run.squad.map((u) => {
    const max = effectiveStats(u).hp;
    return { ...u, hp: Math.min(max, u.hp + Math.round(max * REST_HEAL_PCT)) };
  });
  return { ...run, squad, camp: { rested: true } };
}

function replaceUnit(run: RunState, unit: Unit): RunState {
  return { ...run, squad: run.squad.map((u) => (u.id === unit.id ? unit : u)) };
}

/**
 * Camp: change a unit's job and slots. A weapon the new job can't use goes
 * back to the stash.
 */
export function changeLoadout(run: RunState, unitId: string, loadout: Loadout): RunState | { error: string } {
  const unit = run.squad.find((u) => u.id === unitId);
  if (!unit) return { error: 'no such unit' };
  const changed = setLoadout(unit, loadout);
  if ('error' in changed) return changed;
  let next = replaceUnit(run, changed);
  const weapon = changed.gear?.weapon;
  if (weapon && !canEquip(changed, weapon, 'weapon')) next = unequip(next, unitId, 'weapon');
  return next;
}

/** Camp: grant JP straight away (debug builds only). */
export function debugJp(run: RunState, unitId: string, amount: number): RunState {
  const unit = run.squad.find((u) => u.id === unitId);
  return unit ? replaceUnit(run, grantJp(unit, amount).unit) : run;
}

function unequip(run: RunState, unitId: string, slot: GearSlot): RunState {
  const unit = run.squad.find((u) => u.id === unitId)!;
  const current = unit.gear?.[slot];
  if (!current) return run;
  const gear = { ...unit.gear };
  delete gear[slot];
  return { ...replaceUnit(run, { ...unit, gear }), stash: [...run.stash, current] };
}

/**
 * Camp: put an item from the stash in a slot (swapping out whatever was
 * there), or empty the slot with null. HP and MP stay within the new maximums.
 */
export function equip(run: RunState, unitId: string, slot: GearSlot, itemId: string | null): RunState | { error: string } {
  if (!run.squad.some((u) => u.id === unitId)) return { error: 'no such unit' };
  let next = unequip(run, unitId, slot);
  if (itemId) {
    const index = next.stash.indexOf(itemId);
    if (index < 0) return { error: `${itemId} isn't in the stash` };
    const unit = next.squad.find((u) => u.id === unitId)!;
    if (!canEquip(unit, itemId, slot)) return { error: `${unit.name} can't use ${item(itemId).name}` };
    const stash = [...next.stash];
    stash.splice(index, 1);
    next = { ...replaceUnit(next, { ...unit, gear: { ...unit.gear, [slot]: itemId } }), stash };
  }
  const unit = next.squad.find((u) => u.id === unitId)!;
  const max = effectiveStats(unit);
  return replaceUnit(next, { ...unit, hp: Math.min(unit.hp, max.hp), mp: Math.min(unit.mp, max.mp) });
}

// --- Shop ---

function stockShop(run: RunState, act: Act): RunState {
  const rng = createRng(run.rng);
  const pool = Object.values(ITEMS).filter((i) => i.kind !== 'consumable' && i.tier === act).map((i) => i.id);
  const gear: string[] = [];
  while (gear.length < SHOP_GEAR && pool.length) gear.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return { ...run, rng: rng.state(), shop: { gear } };
}

/** Buys one item: gear leaves the shop's stock for the stash; consumables never run out. */
export function buy(run: RunState, itemId: string): RunState | { error: string } {
  if (!run.shop) return { error: 'not at a shop' };
  const i = item(itemId);
  const consumable = i.kind === 'consumable';
  if (consumable ? !SHOP_CONSUMABLES.includes(itemId) : !run.shop.gear.includes(itemId)) return { error: `${i.name} isn't for sale` };
  if (run.gold < i.price) return { error: 'not enough gold' };
  const gold = run.gold - i.price;
  if (consumable) return { ...run, gold, inventory: { ...run.inventory, [itemId]: (run.inventory[itemId] ?? 0) + 1 } };
  return { ...run, gold, stash: [...run.stash, itemId], shop: { gear: run.shop.gear.filter((g) => g !== itemId) } };
}

// --- Shrine ---

function pickShrine(run: RunState): RunState {
  const rng = createRng(run.rng);
  return { ...run, rng: rng.state(), shrine: { eventId: pickOne(rng, SHRINES).id } };
}

export function shrineEvent(run: RunState) {
  const e = SHRINES.find((s) => s.id === run.shrine?.eventId);
  if (!e) throw new Error('not at a shrine');
  return e;
}

/** A choice is open if the party can pay any gold it costs. */
export function canChoose(run: RunState, choice: ShrineChoice): boolean {
  const cost = choice.outcomes.reduce((n, o) => n + (o.type === 'gold' && o.amount < 0 ? -o.amount : 0), 0);
  return run.gold >= cost;
}

export function chooseShrine(run: RunState, index: number): RunState | { error: string } {
  if (!run.shrine || run.shrine.result) return { error: 'nothing to choose' };
  const choice = shrineEvent(run).choices[index];
  if (!choice) return { error: 'no such choice' };
  if (!canChoose(run, choice)) return { error: 'not enough gold' };
  const rng = createRng(run.rng);
  let next: RunState = { ...run };
  for (const o of choice.outcomes) {
    switch (o.type) {
      case 'gold':
        next = { ...next, gold: next.gold + o.amount };
        break;
      case 'hp':
        next = {
          ...next,
          squad: next.squad.map((u) => {
            const max = effectiveStats(u).hp;
            return { ...u, hp: Math.max(1, Math.min(max, u.hp + Math.round(max * o.pct))) };
          }),
        };
        break;
      case 'jp':
        next = { ...next, squad: next.squad.map((u) => grantJp(u, o.amount).unit) };
        break;
      case 'item': {
        const count = o.count ?? 1;
        if (item(o.itemId).kind === 'consumable') {
          next = { ...next, inventory: { ...next.inventory, [o.itemId]: (next.inventory[o.itemId] ?? 0) + count } };
        } else {
          next = { ...next, stash: [...next.stash, ...Array.from({ length: count }, () => o.itemId)] };
        }
        break;
      }
      case 'level': {
        if (!next.squad.length) break;
        const lucky = next.squad[rng.int(0, next.squad.length - 1)]!;
        next = replaceUnit(next, levelUp(lucky));
        break;
      }
    }
  }
  return { ...next, rng: rng.state(), shrine: { eventId: run.shrine.eventId, result: choice.result } };
}

function averageLevel(units: readonly Unit[]): number {
  return units.length ? units.reduce((n, u) => n + u.level, 0) / units.length : 1;
}

/** Recruits join at the squad's average level minus 1 (§5.1), in a random base job. */
function offerRecruits(run: RunState, base: Record<Stat, number>): RunState {
  const rng = createRng(run.rng);
  const taken = new Set([...run.squad.map((u) => u.name), ...run.fallen.map((f) => f.name)]);
  const names = UNIT_NAMES.filter((n) => !taken.has(n));
  const baseJobs = Object.values(JOBS).filter((j) => j.tier === 1);
  const level = Math.max(1, Math.round(averageLevel(run.squad)) - 1);
  const recruits: Unit[] = [];
  let nextUnitId = run.nextUnitId;
  for (let i = 0; i < RECRUIT_OFFERS; i++) {
    const name = names.length ? names.splice(rng.int(0, names.length - 1), 1)[0]! : `Recruit ${nextUnitId}`;
    const job = pickOne(rng, baseJobs).id;
    recruits.push(createUnit({ id: `p${nextUnitId++}`, ownerId: 'p1', name, job, base, pos: { x: 0, y: 0 }, facing: 0, level }));
  }
  return { ...run, rng: rng.state(), recruits, nextUnitId };
}

/** Takes one offered recruit, if the squad has room. Only one recruit per visit. */
export function recruit(run: RunState, unitId: string): RunState | { error: string } {
  const pick = run.recruits?.find((u) => u.id === unitId);
  if (!pick) return { error: 'no such recruit' };
  if (run.squad.length >= run.squadSize) return { error: 'the squad is full' };
  return { ...run, squad: [...run.squad, pick], recruits: [] };
}
