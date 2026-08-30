import { Decision, type Verdict } from '@tribunal/shared-types';
import { CollapsibleCard } from './ui';

/** One judge verdict + its short opinion — fixed-size, collapsible (SPEC §11).
 * The name gets its own header line so it stays legible in the narrow column. */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const justified = verdict.decision === Decision.justified;
  const header = (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-text">
        {verdict.personaName}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
            justified
              ? 'bg-justified/15 text-justified'
              : 'bg-not-justified/15 text-not-justified'
          }`}
        >
          {justified ? 'justified' : 'not justified'}
        </span>
        <span className="text-xs text-neutral-500">
          confidence {verdict.confidence}
        </span>
      </div>
    </div>
  );
  return (
    <CollapsibleCard header={header}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {verdict.reasoning}
      </p>
      <div className="mt-3 font-mono text-[11px] text-neutral-500">
        {verdict.model}
      </div>
    </CollapsibleCard>
  );
}
