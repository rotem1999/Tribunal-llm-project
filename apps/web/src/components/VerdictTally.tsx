import type { VerdictTally as Tally } from '@tribunal/shared-types';

/**
 * The non-binding vote tally (SPEC §11 / D5). Explicitly NOT a combined verdict —
 * the tribunal issues none.
 */
export function VerdictTally({ tally }: { tally: Tally | null }) {
  if (!tally) return null;
  const total = tally.justified + tally.not_justified;
  const lead =
    tally.justified === tally.not_justified
      ? 'split'
      : tally.justified > tally.not_justified
        ? 'justified'
        : 'not justified';
  return (
    <div className="rounded-lg border border-divider bg-surface/60 px-4 py-3 text-sm text-neutral-300">
      <span className="text-text">
        {Math.max(tally.justified, tally.not_justified)} of {total} judges:{' '}
        {lead}
      </span>{' '}
      — the tribunal issues no combined verdict.
    </div>
  );
}
