import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { JOBS } from '../src/data/jobs';
import { glade } from '../src/data/maps/glade';
import { BATTLE_MAPS } from '../src/data/maps';
import { gridFromRows, tileAt } from '../src/rules/grid';

// Content is pure data, so a typo only shows up at runtime. Catch it here.
describe('job and ability data', () => {
  const kind = (id: string) => ABILITIES[id]?.kind;

  it.each(Object.values(JOBS))('$id references abilities of the right kind', (job) => {
    expect(kind(job.attack)).toBe('action');
    for (const a of job.actionSet) expect(kind(a.abilityId)).toBe('action');
    for (const p of job.passives) expect(kind(p)).toBe('passive');
    expect(kind(job.ultimate)).toBe('ultimate');
    for (const parent of job.requires) expect(JOBS[parent]).toBeDefined();
  });

  it('gives hybrids two base parents and four abilities', () => {
    for (const job of Object.values(JOBS).filter((j) => j.tier === 2)) {
      expect(job.requires.map((r) => JOBS[r]!.tier)).toEqual([1, 1]);
      expect(job.actionSet).toHaveLength(4);
    }
  });

  it('gives every passive an effect and every combo a trigger', () => {
    for (const a of Object.values(ABILITIES)) {
      if (a.kind === 'passive') expect(a.passive?.length).toBeGreaterThan(0);
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
});
