import { describe, expect, it } from '@jest/globals';
import { counterbalancedOrder } from './speech-order';

/**
 * Counterbalanced speech ordering (SPEC §2.1, §5.5). Each judge i sees the
 * speeches rotated by its own index — deterministic, no RNG — so no single
 * ordering bias favors one advocate across the three judges.
 */
describe('counterbalancedOrder', () => {
  const speeches = ['A', 'B', 'C', 'D'];

  it('judge 0 gets the identity order (no rotation)', () => {
    expect(counterbalancedOrder(speeches, 0)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('judge i is rotated left by i (reads a different speech first)', () => {
    expect(counterbalancedOrder(speeches, 1)).toEqual(['B', 'C', 'D', 'A']);
    expect(counterbalancedOrder(speeches, 2)).toEqual(['C', 'D', 'A', 'B']);
  });

  it('gives the 3 judges 3 distinct orders for 4 speeches', () => {
    const orders = [0, 1, 2].map((i) =>
      counterbalancedOrder(speeches, i).join(','),
    );
    expect(new Set(orders).size).toBe(3);
  });

  it('is a pure rotation — same multiset of speeches, no drops or dups', () => {
    for (let i = 0; i < 6; i++) {
      const out = counterbalancedOrder(speeches, i);
      expect(out).toHaveLength(speeches.length);
      expect([...out].sort()).toEqual([...speeches].sort());
    }
  });

  it('is deterministic across repeated calls', () => {
    const a = counterbalancedOrder(speeches, 2);
    const b = counterbalancedOrder(speeches, 2);
    expect(a).toEqual(b);
  });

  it('normalizes indices >= n by modulo (judge 4 == judge 0 for n=4)', () => {
    expect(counterbalancedOrder(speeches, 4)).toEqual(
      counterbalancedOrder(speeches, 0),
    );
    expect(counterbalancedOrder(speeches, 5)).toEqual(
      counterbalancedOrder(speeches, 1),
    );
  });

  it('handles negative indices without going out of bounds', () => {
    const out = counterbalancedOrder(speeches, -1);
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual([...speeches].sort());
    // -1 mod 4 == 3, so it matches judge 3's rotation.
    expect(out).toEqual(counterbalancedOrder(speeches, 3));
  });

  it('returns [] for an empty list and does not divide by zero', () => {
    expect(counterbalancedOrder([], 0)).toEqual([]);
    expect(counterbalancedOrder([], 3)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = ['A', 'B', 'C', 'D'];
    counterbalancedOrder(input, 2);
    expect(input).toEqual(['A', 'B', 'C', 'D']);
  });
});
