import { describe, expect, it } from '@jest/globals';
import { isOverBudget } from './budget-guard';

/**
 * Per-run cost ceiling guard (SPEC §5.5). Over-budget is a strict `>` on the
 * cumulative cost vs. the run's snapshotted ceiling.
 */
describe('isOverBudget', () => {
  it('is over budget when cumulative cost strictly exceeds the ceiling', () => {
    expect(isOverBudget(1.51, 1.5)).toBe(true);
  });

  it('is NOT over budget when exactly at the ceiling (inclusive ceiling)', () => {
    expect(isOverBudget(1.5, 1.5)).toBe(false);
  });

  it('is not over budget below the ceiling', () => {
    expect(isOverBudget(0.25, 1.5)).toBe(false);
  });

  it('free models (cost 0) never trip a positive ceiling', () => {
    expect(isOverBudget(0, 1.5)).toBe(false);
  });

  it('cost 0 does not exceed a ceiling of 0', () => {
    expect(isOverBudget(0, 0)).toBe(false);
  });

  it('any positive cost exceeds a zero ceiling', () => {
    expect(isOverBudget(0.000001, 0)).toBe(true);
  });

  it('handles tiny fractional overages', () => {
    expect(isOverBudget(2.000001, 2)).toBe(true);
    expect(isOverBudget(1.999999, 2)).toBe(false);
  });
});
