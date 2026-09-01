import type { ModelInfo } from '@tribunal/shared-types';

/** Per-1M-token price label, e.g. "$0.60 / $2.40 per 1M" (in / out). */
function priceLabel(m: ModelInfo): string {
  if (m.isFree) return 'free';
  const inM = (m.promptUsd * 1e6).toFixed(2);
  const outM = (m.completionUsd * 1e6).toFixed(2);
  return `$${inM} / $${outM} per 1M`;
}

/**
 * A single model `<select>` (SPEC §11). Shows free models by default; paid
 * models appear only when `showPaid` is on — except the currently-selected model,
 * which is always shown so a hidden-but-chosen paid model never vanishes. Mode A
 * offers an "Auto" option (`value=""`); Mode B requires an explicit pick.
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
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-neutral-800 bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
    >
      {allowAuto ? (
        <option value="">Auto (top free model)</option>
      ) : (
        <option value="" disabled>
          Choose a model…
        </option>
      )}
      {visible.map((m) => (
        <option key={m.id} value={m.id}>
          {m.id} — {priceLabel(m)}
        </option>
      ))}
    </select>
  );
}
