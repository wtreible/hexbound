import { FACING_STEPS, inBounds, manhattan, stepToward, tileAt } from './grid';
import { effectiveStats } from './jobs';
import type { AbilityDef, Effect, Grid, Pos, Unit } from './types';
import { isDowned, isStanding, unitAt } from './units';

// Combat math (DESIGN.md §5.3). Starting values; tune later.
export const HEIGHT_DAMAGE_PER_TIER = 0.1;
export const HEIGHT_DAMAGE_CAP = 0.3;
export const PHYSICAL_BASE_HIT = 90;
export const MIN_HIT = 5;
export const FACING_BONUS = {
  front: { hit: 0, damage: 0 },
  side: { hit: 15, damage: 0.1 },
  back: { hit: 30, damage: 0.25 },
} as const;

export type Side = keyof typeof FACING_BONUS;

/** Which side of the target the attacker stands on, judged by the dominant axis. */
export function attackSide(attacker: Pos, target: Unit): Side {
  const d = { x: attacker.x - target.pos.x, y: attacker.y - target.pos.y };
  if (d.x === 0 && d.y === 0) return 'front';
  const f = FACING_STEPS[target.facing]!;
  const dot = d.x * f.x + d.y * f.y;
  const cross = Math.abs(d.x * f.y - d.y * f.x);
  if (dot > cross) return 'front';
  if (-dot > cross) return 'back';
  return 'side';
}

/** Tiers the attacker stands above the target (negative when below). */
export function heightAbove(grid: Grid, from: Pos, to: Pos): number {
  return (tileAt(grid, from)?.height ?? 0) - (tileAt(grid, to)?.height ?? 0);
}

export function maxRange(grid: Grid, ability: AbilityDef, from: Pos, to: Pos): number {
  const bonus = ability.range.heightBonus ? Math.floor(Math.max(0, heightAbove(grid, from, to)) / 2) : 0;
  return ability.range.max + bonus;
}

// Line of sight is not checked yet (DESIGN.md: rules/grid.ts, later milestone).
export function inRange(grid: Grid, ability: AbilityDef, from: Pos, target: Pos): boolean {
  if (!inBounds(grid, target)) return false;
  const d = manhattan(from, target);
  return d >= ability.range.min && d <= maxRange(grid, ability, from, target);
}

/** Every tile the ability can be aimed at from `from`. */
export function targetTiles(grid: Grid, ability: AbilityDef, from: Pos): Pos[] {
  const out: Pos[] = [];
  const r = ability.range.max + (ability.range.heightBonus ? 10 : 0);
  for (let y = from.y - r; y <= from.y + r; y++) {
    for (let x = from.x - r; x <= from.x + r; x++) {
      if (inRange(grid, ability, from, { x, y })) out.push({ x, y });
    }
  }
  return out;
}

export function areaTiles(grid: Grid, ability: AbilityDef, from: Pos, target: Pos): Pos[] {
  const { shape, size } = ability.area;
  const out: Pos[] = [];
  const step = stepToward(from, target);
  const dir = { x: step.x - from.x, y: step.y - from.y };
  switch (shape) {
    case 'single':
      out.push(target);
      break;
    case 'cross':
      out.push(target);
      for (const d of FACING_STEPS) {
        for (let k = 1; k <= size; k++) out.push({ x: target.x + d.x * k, y: target.y + d.y * k });
      }
      break;
    case 'diamond':
      for (let y = -size; y <= size; y++) {
        for (let x = -size; x <= size; x++) {
          if (Math.abs(x) + Math.abs(y) <= size) out.push({ x: target.x + x, y: target.y + y });
        }
      }
      break;
    case 'line':
      for (let k = 0; k <= size; k++) out.push({ x: target.x + dir.x * k, y: target.y + dir.y * k });
      break;
    case 'cone':
      // Widens by one tile on each side per step away from the caster.
      for (let k = 0; k <= size; k++) {
        for (let s = -k; s <= k; s++) {
          out.push({ x: target.x + dir.x * k + dir.y * s, y: target.y + dir.y * k + dir.x * s });
        }
      }
      break;
  }
  return out.filter((p) => inBounds(grid, p));
}

/** Abilities that can miss: anything that damages or pushes. */
export function isHostile(ability: AbilityDef): boolean {
  return ability.effects.some((e) => e.type === 'damage' || e.type === 'push');
}

/** Chance in [0, 1] that a hostile ability connects with the target. */
export function hitChance(ability: AbilityDef, attackerPos: Pos, target: Unit): number {
  if (!isHostile(ability) || ability.tags.includes('magic')) return 1;
  const side = attackSide(attackerPos, target);
  const evade = effectiveStats(target).evade;
  const pct = PHYSICAL_BASE_HIT + FACING_BONUS[side].hit - evade;
  return Math.min(100, Math.max(MIN_HIT, pct)) / 100;
}

/** damage = max(1, round((stat * power - defence) * modifiers)) */
export function damageAmount(
  grid: Grid,
  effect: Extract<Effect, { type: 'damage' }>,
  attacker: Unit,
  target: Unit,
): number {
  const a = effectiveStats(attacker);
  const t = effectiveStats(target);
  const defence = effect.stat === 'atk' ? t.def : t.res;
  const height = Math.min(HEIGHT_DAMAGE_CAP, Math.max(0, heightAbove(grid, attacker.pos, target.pos)) * HEIGHT_DAMAGE_PER_TIER);
  const facing = FACING_BONUS[attackSide(attacker.pos, target)].damage;
  const raw = (a[effect.stat] * effect.power - defence) * (1 + height) * (1 + facing);
  return Math.max(1, Math.round(raw));
}

export function healAmount(effect: Extract<Effect, { type: 'heal' }>, caster: Unit): number {
  return Math.round(effectiveStats(caster)[effect.stat] * effect.power);
}

export type TargetPreview = {
  unit: Unit;
  hitChance: number;
  damage: number;
  heal: number;
  revive: boolean;
  /** Damage would take the target to 0 HP if it hits. */
  downs: boolean;
};

/**
 * What an ability would do to each unit in its area, without rolling. The
 * caster may be hypothetical (e.g. an AI candidate standing elsewhere).
 */
export function previewAct(grid: Grid, units: readonly Unit[], caster: Unit, ability: AbilityDef, target: Pos): TargetPreview[] {
  const others = units.map((u) => (u.id === caster.id ? caster : u));
  const out: TargetPreview[] = [];
  for (const p of areaTiles(grid, ability, caster.pos, target)) {
    const unit = unitAt(others, p.x, p.y);
    if (!unit) continue;
    let damage = 0;
    let heal = 0;
    let revive = false;
    for (const e of ability.effects) {
      if (e.type === 'damage' && isStanding(unit)) damage += damageAmount(grid, e, caster, unit);
      if (e.type === 'heal' && isStanding(unit)) heal += healAmount(e, caster);
      if (e.type === 'revive' && isDowned(unit)) revive = true;
    }
    heal = Math.min(heal, effectiveStats(unit).hp - unit.hp);
    out.push({
      unit,
      hitChance: isStanding(unit) ? hitChance(ability, caster.pos, unit) : 1,
      damage,
      heal,
      revive,
      downs: damage >= unit.hp && isStanding(unit),
    });
  }
  return out;
}
