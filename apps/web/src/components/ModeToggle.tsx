import { RunMode } from '@tribunal/shared-types';

const OPTIONS: { mode: RunMode; label: string; hint: string }[] = [
  {
    mode: RunMode.A_single,
    label: 'Single model',
    hint: 'One model serves all 7 personas.',
  },
  {
    mode: RunMode.B_per_persona,
    label: 'Model per persona',
    hint: 'Pick a model for each of the 7 personas.',
  },
];

/** Mode A/B toggle (SPEC §1.1, §11). */
export function ModeToggle({
  value,
  onChange,
}: {
  value: RunMode;
  onChange: (mode: RunMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const active = o.mode === value;
        return (
          <button
            key={o.mode}
            type="button"
            onClick={() => onChange(o.mode)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              active
                ? 'border-accent bg-accent/10'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="text-sm font-medium text-text">{o.label}</div>
            <div className="mt-1 text-xs text-neutral-500">{o.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
