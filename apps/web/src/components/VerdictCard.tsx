import { Decision, type Verdict } from '@tribunal/shared-types';
import { Card } from './ui';

/** Friendly stand-in when a judge's opinion was cut off/unreadable (SPEC §5.6/§11). */
const RECESS_COPY =
  "This judge stepped out for a brief recess and didn't file an opinion — their model's reply was cut off before it finished.";

/**
 * One judge verdict (SPEC §11). Reads top-to-bottom as (1) the **verdict** —
 * name, decision badge, confidence — then (2) a labelled **Reasoning** section
 * with that judge's short opinion (how it weighed the speeches it saw). When the
 * verdict is `truncated` (§5.6: the model's reply was cut off or unreadable), the
 * Reasoning section shows a friendly recess placeholder instead of raw/garbled
 * text; the decision + confidence are still shown unchanged.
 *
 * The judges sit in a single shared-height row, so a VerdictCard is **not**
 * individually collapsible: its open/closed state is driven by the `open` prop
 * from the Judges section's one group control (all judgements or none).
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
      {/* (1) Verdict — decision + confidence. */}
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

      {/* (2) Reasoning — the judge's own opinion, or a recess placeholder. */}
      <div className="px-4 pb-4">
        <div className={`relative ${open ? '' : 'max-h-28 overflow-hidden'}`}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            Reasoning
          </div>
          {verdict.truncated ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm italic leading-relaxed text-neutral-400">
              <span aria-hidden="true">🚪</span>
              <span>{RECESS_COPY}</span>
            </p>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
              {verdict.reasoning}
            </p>
          )}
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
