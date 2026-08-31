import { Decision, type Verdict } from '@tribunal/shared-types';
import { Card } from './ui';

/**
 * One judge verdict + its short opinion (SPEC §11). The judges sit in a single
 * shared-height row, so a VerdictCard is **not** individually collapsible: its
 * open/closed state is driven by the `open` prop from the Judges section's one
 * group control (you read all judgements or none — never a single judge). The
 * name gets its own header line so it stays legible in the narrow column.
 */
export function VerdictCard({
  verdict,
  open = false,
}: {
  verdict: Verdict;
  open?: boolean;
}) {
  const justified = verdict.decision === Decision.justified;
  return (
    <Card className="overflow-hidden">
      <div className="min-w-0 p-4">
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
      <div className="px-4 pb-4">
        <div className={`relative ${open ? '' : 'max-h-24 overflow-hidden'}`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {verdict.reasoning}
          </p>
          <div className="mt-3 font-mono text-[11px] text-neutral-500">
            {verdict.model}
          </div>
          {!open && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          )}
        </div>
      </div>
    </Card>
  );
}
