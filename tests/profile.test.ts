import { describe, expect, it } from 'vitest';
import { RELICS } from '../src/data/relics';
import { SHRINES } from '../src/data/shrines';
import { BASE_STATS } from '../src/data/units';
import { FIRST_JOBS, newProfile, newUnlocks, recordRun, relicUnlocked, shrinePool, unlockedRelics } from '../src/rules/profile';
import { newRun, type RunState } from '../src/rules/run';

const run = (patch: Partial<RunState> = {}): RunState => ({
  ...newRun({ seed: 1, draft: [{ name: 'Ada', job: 'squire', ownerId: 'p1' }], base: BASE_STATS, squadSize: 4 }),
  ...patch,
});
const relic = (id: string) => RELICS.find((r) => r.id === id)!;

describe('profile', () => {
  it('starts with Squire, Archer and Acolyte and only the free relics and shrines', () => {
    const p = newProfile();
    expect(p.startingJobs).toEqual(FIRST_JOBS);
    expect(unlockedRelics(p).every((r) => !r.unlock)).toBe(true);
    expect(shrinePool(p)).toEqual(SHRINES.filter((s) => !s.unlock).map((s) => s.id));
  });

  it('adds a mastered base job to the draft pool, but not an advanced one', () => {
    const p = recordRun(newProfile(), run({ masteredJobs: ['thief', 'paladin'] }));
    expect(p.startingJobs).toContain('thief');
    expect(p.startingJobs).not.toContain('paladin');
    expect(p.masteredJobs).toEqual(['thief', 'paladin']);
    expect(relicUnlocked(p, relic('scholars-tome'))).toBe(true);
  });

  it('opens Codex entries for jobs held or unlocked', () => {
    const r = run();
    const ready = { ...r, squad: r.squad.map((u) => ({ ...u, jpTotal: { squire: 250, acolyte: 100 } })) };
    expect(recordRun(newProfile(), ready).seenJobs).toContain('paladin');
  });

  it('only counts a run once it is finished, and can be folded in repeatedly', () => {
    const r = run({ status: 'won', bossesBeaten: ['1-boss'] });
    const mid = recordRun(recordRun(newProfile(), r), r);
    expect(mid).toMatchObject({ runs: 0, wins: 0, bossesBeaten: ['1-boss'] });
    const done = recordRun(mid, r, true);
    expect(done).toMatchObject({ runs: 1, wins: 1 });
    expect(relicUnlocked(done, relic('veterans-banner'))).toBe(true);
    expect(relicUnlocked(done, relic('whetstone'))).toBe(true);
    expect(shrinePool(done).length).toBe(SHRINES.length);
  });

  it('lists what a run newly unlocked', () => {
    const before = newProfile();
    const after = recordRun(before, run({ status: 'lost', masteredJobs: ['mage'] }), true);
    const lines = newUnlocks(before, after);
    expect(lines).toContain('Mage can now be drafted');
    expect(lines).toContain('Relic: Coin Purse');
    expect(lines.some((l) => l.startsWith('Shrine:'))).toBe(true);
  });
});
