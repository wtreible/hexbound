import { previewAct, targetTiles } from './combat';
import { distanceMap, facingOfStep, indexOf, manhattan, reachable, stepToward } from './grid';
import { abilitiesOf, effectiveStats } from './jobs';
import type { Facing, GameState, Intent, Pos, Unit } from './types';
import { findUnit, isStanding, sameSide } from './units';

// Enemy AI (docs/DESIGN.md §10). Enumerates every (reachable tile x ability x
// target) and scores it; with nothing worth doing it closes distance.
// Danger and objective terms arrive with the presets that use them.

export type AiWeights = {
  /** Per point of expected damage to foes (allies count double, negatively). */
  damage: number;
  /** Per expected foe downed. */
  kill: number;
  /** Per point of healing on allies. */
  heal: number;
};

export const AI_PRESETS = {
  berserker: { damage: 1, kill: 40, heal: 0 },
} satisfies Record<string, AiWeights>;

type Plan = { score: number; steps: number; move?: Pos; act?: { abilityId: string; target: Pos } };

/** The intents for one enemy turn: optional move, optional act, face, wait. */
export function planTurn(state: GameState, unitId: string, weights: AiWeights = AI_PRESETS.berserker): Intent[] {
  const unit = findUnit(state.units, unitId);
  if (!unit) return [];
  const { grid } = state;
  const stats = effectiveStats(unit);
  const reach = reachable(grid, state.units, unit, stats);
  const foes = state.units.filter((u) => isStanding(u) && !sameSide(u, unit));

  let best: Plan = { score: 0, steps: 0 };
  for (const node of reach.values()) {
    if (!node.canStop) continue;
    const moved: Unit = { ...unit, pos: node.pos };
    for (const ability of abilitiesOf(unit)) {
      if ((ability.cost?.mp ?? 0) > unit.mp) continue;
      for (const target of targetTiles(grid, ability, node.pos)) {
        let score = 0;
        for (const p of previewAct(grid, state.units, moved, ability, target)) {
          const ally = sameSide(p.unit, unit);
          const expected = p.damage * p.hitChance;
          score += ally ? -2 * expected * weights.damage : expected * weights.damage;
          if (!ally && p.downs) score += p.hitChance * weights.kill;
          if (ally) score += p.heal * weights.heal;
        }
        // Prefer cheaper abilities and shorter walks on ties.
        score -= (ability.cost?.mp ?? 0) * 0.01;
        if (score > best.score || (score === best.score && best.act && node.cost < best.steps)) {
          best = { score, steps: node.cost, move: node.pos, act: { abilityId: ability.id, target } };
        }
      }
    }
  }

  const intents: Intent[] = [];
  let finalPos = unit.pos;
  if (best.act) {
    if (best.move && indexOf(grid, best.move) !== indexOf(grid, unit.pos)) {
      intents.push({ type: 'move', unitId, to: best.move });
      finalPos = best.move;
    }
    intents.push({ type: 'act', unitId, ...best.act });
  } else if (foes.length) {
    // Nothing to hit: walk to the reachable tile closest to any foe.
    const dist = distanceMap(grid, foes.map((f) => f.pos), stats.jump);
    let bestTile = unit.pos;
    let bestDist = dist[indexOf(grid, unit.pos)]!;
    for (const node of reach.values()) {
      const d = dist[indexOf(grid, node.pos)]!;
      if (node.canStop && d < bestDist) {
        bestDist = d;
        bestTile = node.pos;
      }
    }
    if (indexOf(grid, bestTile) !== indexOf(grid, unit.pos)) {
      intents.push({ type: 'move', unitId, to: bestTile });
      finalPos = bestTile;
    }
  }

  const nearest = nearestFoe(finalPos, foes);
  if (nearest) intents.push({ type: 'face', unitId, facing: faceToward(finalPos, nearest.pos) });
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
