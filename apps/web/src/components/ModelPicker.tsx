import type { ModelInfo } from '@tribunal/shared-types';

/** Per-1M-token price label, e.g. "$0.60 / $2.40 per 1M" (in / out). */
function priceLabel(m: ModelInfo): string {
  if (m.isFree) return 'free';
  const inM = (m.promptUsd * 1e6).toFixed(2);
  const outM = (m.completionUsd * 1e6).toFixed(2);
  return `$${inM} / $${outM} per 1M`;
}

/** Chevron affordance for the closed <select> (matches the Nocturne Caret). */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 transition-colors"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * A single model `<select>` (SPEC §11), styled to match the Nocturne cards:
 * rounded-lg tinted surface, custom chevron, accent focus ring. Shows free
 * models by default; paid models appear only when `showPaid` is on — except the
 * currently-selected model, which is always shown so a hidden-but-chosen paid
 * model never vanishes. Mode A offers an "Auto" option (`value=""`); Mode B
 * requires an explicit pick. A caption under the field spells out the price of
 * the selected paid model in accent so the cost is never a surprise.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  showPaid,
  allowAuto = false,
  id,
}: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  showPaid: boolean;
  allowAuto?: boolean;
  id?: string;
}) {
  const visible = models.filter((m) => showPaid || m.isFree || m.id === value);
  const selected = models.find((m) => m.id === value) ?? null;
  return (
    <div className="space-y-1.5">
      <div className="group relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-divider bg-surface py-2.5 pl-3 pr-10 text-sm text-text transition-colors hover:border-neutral-700 focus:border-accent focus:outline-none"
        >
          {allowAuto ? (
            <option value="">Auto · top free model</option>
          ) : (
            <option value="" disabled>
              Choose a model…
            </option>
          )}
          {visible.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id} · {priceLabel(m)}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
      {selected &&
        (selected.isFree ? (
          <p className="pl-0.5 font-mono text-[11px] text-justified">free</p>
        ) : (
          <p className="pl-0.5 font-mono text-[11px] text-accent-2">
            {priceLabel(selected)} tokens · paid
          </p>
        ))}
    </div>
  );
}
