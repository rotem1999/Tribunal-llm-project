import { describe, expect, it } from '@jest/globals';
import { Decision } from '@tribunal/shared-types';
import { computeTally } from './verdict-tally';

/**
 * Verdict tally (SPEC §4.3, §5.5 / D5). This is a NON-binding display count of
 * the three judges' decisions. A core design invariant is that the system does
 * NOT produce a combined / authoritative verdict — so the tally must only ever
 * carry the two per-decision counts and nothing that looks like a "final".
 */
describe('computeTally', () => {
  it('counts a unanimous 3-0 justified split', () => {
    const tally = computeTally([
      Decision.justified,
      Decision.justified,
      Decision.justified,
    ]);
    expect(tally[Decision.justified]).toBe(3);
    expect(tally[Decision.not_justified]).toBe(0);
  });

  it('counts a unanimous 0-3 not_justified split', () => {
    const tally = computeTally([
      Decision.not_justified,
      Decision.not_justified,
      Decision.not_justified,
    ]);
    expect(tally[Decision.justified]).toBe(0);
    expect(tally[Decision.not_justified]).toBe(3);
  });

  it('counts a split 2-1 decision', () => {
    const tally = computeTally([
      Decision.justified,
      Decision.not_justified,
      Decision.justified,
    ]);
    expect(tally[Decision.justified]).toBe(2);
    expect(tally[Decision.not_justified]).toBe(1);
  });

  it('starts both counts at zero for an empty input', () => {
    const tally = computeTally([]);
    expect(tally[Decision.justified]).toBe(0);
    expect(tally[Decision.not_justified]).toBe(0);
  });

  it('exposes ONLY the two decision counts — no combined/final verdict field', () => {
    const tally = computeTally([Decision.justified, Decision.not_justified]);
    const keys = Object.keys(tally).sort();
    expect(keys).toEqual([Decision.justified, Decision.not_justified].sort());
    // Guard against any authoritative-verdict field sneaking in.
    for (const forbidden of [
      'finalDecision',
      'final',
      'verdict',
      'winner',
      'decision',
      'majority',
      'outcome',
      'result',
    ]) {
      expect(tally as Record<string, unknown>).not.toHaveProperty(forbidden);
    }
  });

  it('total of the two counts equals the number of judges tallied', () => {
    const decisions = [
      Decision.justified,
      Decision.not_justified,
      Decision.not_justified,
    ];
    const tally = computeTally(decisions);
    expect(tally[Decision.justified] + tally[Decision.not_justified]).toBe(
      decisions.length,
    );
  });
});
