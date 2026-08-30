import { Decision, type VerdictTally } from '@tribunal/shared-types';

/**
 * Non-binding count of the 3 verdicts, for display only (SPEC §4.3, §5.5 / D5).
 * The system produces NO authoritative combined verdict — this is just a tally.
 */
export function computeTally(decisions: Decision[]): VerdictTally {
  const tally: VerdictTally = {
    [Decision.justified]: 0,
    [Decision.not_justified]: 0,
  };
  for (const d of decisions) tally[d] += 1;
  return tally;
}
