import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rules/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('diverges for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('resumes from a saved state', () => {
    const a = createRng(7);
    a.next();
    a.next();
    const b = createRng(a.state());
    for (let i = 0; i < 20; i++) expect(b.next()).toBe(a.next());
  });

  it('keeps next() in [0, 1) and int() within bounds', () => {
    const r = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-3, 3);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(3);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});
