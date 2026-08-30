import type { VerdictTally as Tally } from '@tribunal/shared-types';

/**
 * Non-binding count of the 3 verdicts (SPEC §11 / D5) — a bare count, no
 * disclaimer copy (UX rule 1). The tribunal issues no combined verdict; that
 * behavior stands regardless of what is shown here.
 */
export function VerdictTally({ tally }: { tally: Tally | null }) {
  if (!tally) return null;
  return (
    <div className="text-sm text-neutral-400">
      <span className="text-justified">Justified {tally.justified}</span>
      <span className="px-2 text-neutral-600">·</span>
      <span className="text-not-justified">
        Not justified {tally.not_justified}
      </span>
    </div>
  );
}
