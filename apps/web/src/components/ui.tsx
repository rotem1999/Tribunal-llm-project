import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

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
