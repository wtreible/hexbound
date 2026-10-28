import { areaTiles, damageScale, previewAct, targetTiles } from './combat';
import { distanceMap, facingOfStep, indexOf, manhattan, reachable, stepToward } from './grid';
import { abilitiesOf, canAfford, canUse, effectiveStats, jobOf } from './jobs';
import type { Facing, GameState, Intent, Pos, StatusId, Unit } from './types';
import { findUnit, isStanding, sameSide } from './units';

// Unit AI (docs/DESIGN.md §10). Every reachable tile is scored, both standing
// there and acting from it with each ability on each target:
//   damage + kills + healing + revives - danger at the tile - distance terms.
// The best plan becomes a move, an act, a facing and a wait.

export type AiWeights = {
  /** Per point of expected damage to foes (allies count double, negatively). */
  damage: number;
  /** Per expected foe downed. */
  kill: number;
  /** Per point of healing on allies. */
  heal: number;
  /** Per downed ally revived. */
  revive: number;
  /** Per point of damage foes could deal to the unit at its end tile next turn. */
  danger: number;
  /** Per step of walking distance to the nearest foe. */
  approach: number;
  /** Per step of walking distance to the goal tiles (escort, escape), when given. */
  objective: number;
  /** Per expected status landed: harmful on foes, helpful on allies (summons count double). */
  status: number;
};

export const AI_PRESETS = {
  /** Enemies: charge in and hit the best target. */
  berserker: { damage: 1, kill: 40, heal: 0, revive: 0, danger: 0, approach: 0.5, objective: 0, status: 4 },
  /** Keeps its distance; attacks when it's safe (necromancers, assassins). Negative approach backs off. */
  coward: { damage: 0.9, kill: 30, heal: 0.5, revive: 10, danger: 1.2, approach: -0.15, objective: 0, status: 6 },
  /** Heals and shields its side before anything else. */
  healer: { damage: 0.3, kill: 15, heal: 2, revive: 50, danger: 0.7, approach: 0.05, objective: 0, status: 6 },
  /** Fights from range and avoids danger. */
  sniper: { damage: 1, kill: 35, heal: 0, revive: 0, danger: 0.7, approach: 0.05, objective: 0, status: 5 },
  /** Bosses: aggressive, hard-hitting, mostly ignore danger. */
  boss: { damage: 1.2, kill: 50, heal: 0.5, revive: 0, danger: 0.2, approach: 0.4, objective: 0, status: 5 },
  /** Player units under AI control: keep out of reach, let foes come, heal and revive. */
  cautious: { damage: 1, kill: 30, heal: 1.5, revive: 40, danger: 0.4, approach: 0.1, objective: 0, status: 4 },
  /** Escort targets: head for the exit and stay safe. */
  escort: { damage: 0, kill: 0, heal: 0, revive: 0, danger: 0.3, approach: 0, objective: 5, status: 0 },
} satisfies Record<string, AiWeights>;

/** Statuses that hurt whoever has them; the rest help. */
const HARMFUL: ReadonlySet<StatusId> = new Set(['pinned', 'slow', 'poison', 'blind', 'silence', 'mark', 'weaken']);

/** The preset a unit plays with: its job's for enemies, escort for NPCs, cautious for the player's side. */
export function presetFor(unit: Unit): AiPreset {
  if (unit.ownerId === 'npc') return 'escort';
  if (unit.ownerId !== 'enemy') return 'cautious';
  return jobOf(unit).ai ?? 'berserker';
}

export type AiPreset = keyof typeof AI_PRESETS;

type Plan = { score: number; steps: number; move: Pos; act?: { abilityId: string; target: Pos } };

/**
 * Damage foes could deal to `unit` on each tile next turn: for every foe, the
 * hardest-hitting ability that reaches the tile from anywhere it can move,
 * summed over foes. Ignores height and facing to stay cheap.
 */
export function dangerMap(state: GameState, unit: Unit): number[] {
  const { grid } = state;
  const danger = grid.tiles.map(() => 0);
  const defence = effectiveStats(unit);
  for (const foe of state.units.filter((u) => isStanding(u) && !sameSide(u, unit))) {
    const stats = effectiveStats(foe);
    const stops = [...reachable(grid, state.units, foe, stats).values()].filter((n) => n.canStop);
    const worst = new Map<number, number>();
    for (const ability of abilitiesOf(foe)) {
      if (!canAfford(foe, ability)) continue;
      let amount = 0;
      for (const e of ability.effects) {
        if (e.type === 'damage') amount += Math.max(1, (stats[e.stat] * e.power - (e.stat === 'atk' ? defence.def : defence.res)) * damageScale(foe));
      }
      if (!amount) continue;
      const reached = new Set<number>();
      for (const s of stops) {
        const at: Unit = { ...foe, pos: s.pos };
        for (const t of targetTiles(grid, ability, at)) for (const p of areaTiles(grid, ability, s.pos, t)) reached.add(indexOf(grid, p));
      }
      for (const i of reached) worst.set(i, Math.max(worst.get(i) ?? 0, amount));
    }
    for (const [i, v] of worst) danger[i]! += v;
  }
  return danger;
}

/** The intents for one unit's turn: optional move, optional act, face, wait. */
export function planTurn(state: GameState, unitId: string, preset?: AiPreset, goals: Pos[] = []): Intent[] {
  const unit = findUnit(state.units, unitId);
  if (!unit) return [];
  const weights = AI_PRESETS[preset ?? presetFor(unit)];
  const { grid } = state;
  const stats = effectiveStats(unit);
  const reach = reachable(grid, state.units, unit, stats);
  const foes = state.units.filter((u) => isStanding(u) && !sameSide(u, unit));
  const danger = weights.danger ? dangerMap(state, unit) : null;
  const toFoes = foes.length ? distanceMap(grid, foes.map((f) => f.pos), stats.jump) : null;
  const toGoal = goals.length && weights.objective ? distanceMap(grid, goals, stats.jump) : null;
  let w: AiWeights = weights;

  /** What standing on a tile is worth, before any action. */
  const tileScore = (p: Pos) => {
    const i = indexOf(grid, p);
    let s = 0;
    if (danger) s -= danger[i]! * w.danger;
    if (toFoes) s -= Math.min(toFoes[i]!, 50) * w.approach;
    if (toGoal) s -= Math.min(toGoal[i]!, 50) * w.objective;
    return s;
  };

  let best: Plan | null = null;
  const consider = (plan: Plan) => {
    if (!best || plan.score > best.score || (plan.score === best.score && plan.steps < best.steps)) best = plan;
  };
  const search = () => {
    for (const node of reach.values()) {
      if (!node.canStop) continue;
      const base = tileScore(node.pos);
      consider({ score: base, steps: node.cost, move: node.pos });
      const moved: Unit = { ...unit, pos: node.pos };
      for (const ability of abilitiesOf(unit)) {
        if (!canUse(unit, ability)) continue;
        for (const target of targetTiles(grid, ability, moved)) {
          let value = 0;
          for (const p of previewAct(grid, state.units, moved, ability, target)) {
            const ally = sameSide(p.unit, unit);
            const expected = p.damage * p.hitChance;
            value += ally ? -2 * expected * w.damage : expected * w.damage;
            if (!ally && p.downs) value += p.hitChance * w.kill;
            if (ally) value += p.heal * w.heal + (p.revive ? w.revive : 0);
            // Statuses: worth landing a harmful one on a foe or a helpful one on an ally that lacks it.
            for (const e of ability.effects) {
              if (e.type !== 'status' || p.unit.statuses.some((s) => s.id === e.status)) continue;
              if (HARMFUL.has(e.status) !== ally) value += e.chance * p.hitChance * w.status;
            }
          }
          for (const e of ability.effects) if (e.type === 'summon') value += 2 * w.status;
          // Only worth acting for a real gain; prefer cheaper abilities on ties.
          if (value <= 0) continue;
          value -= (ability.cost?.mp ?? 0) * 0.01;
          consider({ score: base + value, steps: node.cost, move: node.pos, act: { abilityId: ability.id, target } });
        }
      }
    }
  };
  search();
  // Nothing worth doing from any reachable tile: close in anyway, at a quarter
  // of the caution, so wary and ranged units can't stall a battle out of reach.
  if (foes.length && w.damage > 0 && !(best as Plan | null)?.act) {
    w = {
      ...weights,
      approach: Math.max(weights.approach, 0.5),
      danger: weights.danger * 0.25,
    };
    best = null;
    search();
  }

  const intents: Intent[] = [];
  const plan = best as Plan | null;
  let finalPos = unit.pos;
  if (plan) {
    if (indexOf(grid, plan.move) !== indexOf(grid, unit.pos)) {
      intents.push({ type: 'move', unitId, to: plan.move });
      finalPos = plan.move;
    }
    if (plan.act) intents.push({ type: 'act', unitId, ...plan.act });
  }
  const nearest = nearestFoe(finalPos, foes);
  if (nearest)
    intents.push({
      type: 'face',
      unitId,
      facing: faceToward(finalPos, nearest.pos),
    });
  intents.push({ type: 'wait', unitId });
  return intents;
}

function nearestFoe(from: Pos, foes: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  let bestD = Infinity;
  for (const f of foes) {
    const d = manhattan(f.pos, from);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** Facing that points along the dominant axis from a to b. */
export function faceToward(a: Pos, b: Pos): Facing {
  return facingOfStep(a, stepToward(a, b));
}
