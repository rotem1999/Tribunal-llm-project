import { Side, type Speech } from '@tribunal/shared-types';
import { Card } from './ui';

/** One advocate speech (SPEC §11). */
export function SpeechCard({ speech }: { speech: Speech }) {
  const forAccused = speech.side === Side.support;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          {speech.personaKey}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[11px] uppercase tracking-wide ${
            forAccused
              ? 'bg-accent/15 text-accent-300'
              : 'bg-neutral-800 text-neutral-300'
          }`}
        >
          {forAccused ? 'defense' : 'prosecution'}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {speech.content}
      </p>
      <div className="mt-3 font-mono text-[11px] text-neutral-500">
        {speech.model}
      </div>
    </Card>
  );
}
