import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

/** Nocturne UI primitives: outlined buttons, tinted surfaces, 8px radii. */

export function Button({
  variant = 'primary',
  block,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  block?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'border border-accent text-accent hover:bg-accent/10 active:bg-accent/20'
      : 'border border-transparent text-neutral-300 hover:bg-neutral-800/60';
  return (
    <button
      className={`${base} ${styles} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-neutral-800 bg-surface px-3 py-2 text-sm text-text placeholder:text-neutral-500 focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-xs uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-divider bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
      {children}
    </p>
  );
}

/** Rotating caret — the only affordance a collapsible needs (UX rule 4). */
export function Caret({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
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
 * A surface card whose body sits at a fixed collapsed height and expands on
 * click (UX rules 1, 3, 4: compact by default, immediate feedback, self-evident).
 * The clickable header carries the title/badges; the caret shows the state.
 */
export function CollapsibleCard({
  header,
  children,
  defaultOpen = false,
  className = '',
}: {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/5"
      >
        <div className="min-w-0 flex-1">{header}</div>
        <Caret open={open} />
      </button>
      <div className="px-4 pb-4">
        <div className={`relative ${open ? '' : 'max-h-24 overflow-hidden'}`}>
          {children}
          {!open && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          )}
        </div>
      </div>
    </Card>
  );
}

