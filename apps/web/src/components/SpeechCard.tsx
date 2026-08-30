import { Side, type Speech } from '@tribunal/shared-types';
import { CollapsibleCard } from './ui';

/** One advocate speech — fixed-size, collapsible (SPEC §11). */
export function SpeechCard({ speech }: { speech: Speech }) {
  const forAccused = speech.side === Side.support;
  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
        {speech.personaName}
      </span>
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-[11px] uppercase tracking-wide ${
          forAccused
            ? 'bg-accent/15 text-accent-300'
            : 'bg-neutral-800 text-neutral-300'
        }`}
      >
        {forAccused ? 'defense' : 'prosecution'}
      </span>
    </div>
  );
  return (
    <CollapsibleCard header={header}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {speech.content}
      </p>
      <div className="mt-3 font-mono text-[11px] text-neutral-500">
        {speech.model}
      </div>
    </CollapsibleCard>
  );
}
