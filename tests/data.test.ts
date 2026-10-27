import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { JOBS } from '../src/data/jobs';

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
