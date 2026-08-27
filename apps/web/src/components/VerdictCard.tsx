import { Decision, type Verdict } from '@tribunal/shared-types';
import { Card } from './ui';

/** One judge verdict + its protocol (SPEC §11). */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const justified = verdict.decision === Decision.justified;
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          {verdict.personaKey}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
            justified
              ? 'bg-justified/15 text-justified'
              : 'bg-not-justified/15 text-not-justified'
          }`}
        >
          {justified ? 'justified' : 'not justified'}
        </span>
      </div>
      <div className="mt-2 text-xs text-neutral-500">
        confidence {verdict.confidence}
      </div>
      <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {verdict.reasoning}
      </p>
      <div className="mt-3 font-mono text-[11px] text-neutral-500">
        {verdict.model}
      </div>
    </Card>
  );
}
