import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { JOBS } from '../src/data/jobs';
import { glade } from '../src/data/maps/glade';
import { BATTLE_MAPS } from '../src/data/maps';
import { gridFromRows, tileAt } from '../src/rules/grid';
import type { Pos } from '../src/rules/types';

// Content is pure data, so a typo only shows up at runtime. Catch it here.
describe('job and ability data', () => {
  const kind = (id: string) => ABILITIES[id]?.kind;

  it.each(Object.values(JOBS))('$id references real abilities and jobs', (job) => {
    expect(kind(job.attack)).toBe('action');
    for (const a of job.abilities) {
      expect(kind(a.abilityId), a.abilityId).toBeDefined();
      expect(kind(a.abilityId)).not.toBe('combo');
      expect(a.jp).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(job.abilities.map((a) => a.abilityId)).size).toBe(job.abilities.length);
    for (const r of job.requires) expect(JOBS[r.job], r.job).toBeDefined();
  });

  it('builds a job tree: starting jobs need nothing, advanced jobs need lower tiers', () => {
    for (const job of Object.values(JOBS)) {
      if (job.tier <= 1) expect(job.requires).toEqual([]);
      else {
        expect(job.requires.length).toBeGreaterThan(0);
        for (const r of job.requires) expect(JOBS[r.job]!.tier).toBeLessThan(job.tier);
      }
    }
  });

  it('gives every player job at least one action, a passive slot ability and one ultimate', () => {
    for (const job of Object.values(JOBS).filter((j) => j.tier > 0)) {
      const kinds = job.abilities.map((a) => kind(a.abilityId));
      expect(kinds, job.id).toContain('action');
      expect(kinds.filter((k) => k === 'ultimate'), job.id).toHaveLength(1);
      expect(kinds.some((k) => k === 'reaction' || k === 'support' || k === 'movement'), job.id).toBe(true);
    }
  });

  it('gives every passive an effect and every combo a trigger', () => {
    for (const a of Object.values(ABILITIES)) {
      if (a.kind === 'reaction' || a.kind === 'support' || a.kind === 'movement') expect(a.passive?.length, a.id).toBeGreaterThan(0);
      if (a.kind === 'combo') expect(a.trigger).toBeDefined();
      if (a.kind === 'ultimate') expect(a.cost?.resolve).toBe(100);
    }
  });
});

describe('map templates', () => {
  it.each([...BATTLE_MAPS, glade])('$id has distinct, walkable spawn tiles', (map) => {
    const grid = gridFromRows(map.rows);
    const all = [...map.spawns.player, ...map.spawns.enemy];
    for (const p of all) expect(tileAt(grid, p)?.walkable).toBe(true);
    expect(new Set(all.map((p) => `${p.x},${p.y}`)).size).toBe(all.length);
  });

  it.each(BATTLE_MAPS)('$id fits a full squad and an elite group', (map) => {
    expect(map.spawns.player.length).toBeGreaterThanOrEqual(4);
    expect(map.spawns.enemy.length).toBeGreaterThanOrEqual(5);
  });

  it.each(BATTLE_MAPS)('$id marks walkable exits, hold tiles and an escort start off the spawns', (map) => {
    const grid = gridFromRows(map.rows);
    const marks = [...(map.exits ?? []), ...(map.hold ?? []), map.vip!];
    expect(map.exits?.length).toBeGreaterThan(0);
    expect(map.hold?.length).toBeGreaterThan(0);
    for (const p of marks) expect(tileAt(grid, p)?.walkable).toBe(true);
    const spawns = new Set([...map.spawns.player, ...map.spawns.enemy].map((p) => `${p.x},${p.y}`));
    for (const p of marks) expect(spawns.has(`${p.x},${p.y}`)).toBe(false);
  });

  it.each(BATTLE_MAPS)('$id connects every spawn and marker to both sides at jump 2', (map) => {
    const grid = gridFromRows(map.rows);
    const key = (p: Pos) => `${p.x},${p.y}`;
    // BFS over walkable tiles, orthogonal steps of at most 2 tiers (the lowest jump in the game).
    const reachFrom = (start: Pos) => {
      const seen = new Set([key(start)]);
      const queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        const h = tileAt(grid, p)!.height;
        for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const n = { x: p.x + d.x, y: p.y + d.y };
          const t = tileAt(grid, n);
          if (!t?.walkable || Math.abs(t.height - h) > 2 || seen.has(key(n))) continue;
          seen.add(key(n));
          queue.push(n);
        }
      }
      return seen;
    };
    const targets = [...map.spawns.player, ...map.spawns.enemy, ...(map.exits ?? []), ...(map.hold ?? []), map.vip!];
    for (const start of [map.spawns.player[0]!, map.spawns.enemy[0]!]) {
      const seen = reachFrom(start);
      const missing = targets.filter((p) => !seen.has(key(p))).map(key);
      expect(missing, `unreachable from ${key(start)}`).toEqual([]);
    }
  });
});
