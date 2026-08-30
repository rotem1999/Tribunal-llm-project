import { PersonaRole, Side, type PersonaInfo, type RunPhase } from '@tribunal/shared-types';

/**
 * Live "tribunal in session" animation (SPEC §11): the 4 advocates + 3 judges
 * arranged in a circle, each with a spinning sync icon while its phase is in
 * flight and a check once its speech/verdict has been persisted.
 */

type NodeState = 'done' | 'active' | 'pending';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function stateFor(p: PersonaInfo, done: Set<string>, phase: RunPhase): NodeState {
  if (done.has(p.key)) return 'done';
  if (phase === 'done') return 'pending';
  const active =
    (p.role === PersonaRole.advocate && phase === 'advocates') ||
    (p.role === PersonaRole.judge && phase === 'judges');
  return active ? 'active' : 'pending';
}

function roleLabel(p: PersonaInfo): string {
  if (p.role === PersonaRole.judge) return 'Judge';
  return p.side === Side.support ? 'Defense' : 'Prosecution';
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
      stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PersonaNode({ p, state }: { p: PersonaInfo; state: NodeState }) {
  const ring =
    state === 'done'
      ? 'border-justified text-justified'
      : state === 'active'
        ? 'border-accent text-accent animate-pulse'
        : 'border-divider text-neutral-500';
  return (
    <div className="flex w-24 flex-col items-center gap-1 text-center">
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-surface font-heading text-sm font-semibold ${ring}`}
        >
          {initials(p.name)}
        </div>
        <div
          className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-divider bg-bg ${
            state === 'done' ? 'text-justified' : state === 'active' ? 'text-accent' : 'text-neutral-600'
          }`}
        >
          {state === 'done' ? <CheckIcon /> : <SyncIcon />}
        </div>
      </div>
      <div className="text-xs font-medium leading-tight text-text">{p.name}</div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{roleLabel(p)}</div>
    </div>
  );
}

export function TribunalCircle({
  personas,
  done,
  phase,
}: {
  personas: PersonaInfo[];
  done: Set<string>;
  phase: RunPhase;
}) {
  // Advocates first, then judges — a stable ring order.
  const ring = [
    ...personas.filter((p) => p.role === PersonaRole.advocate),
    ...personas.filter((p) => p.role === PersonaRole.judge),
  ];
  const n = ring.length || 1;
  const R = 40; // percent radius

  const phaseText =
    phase === 'advocates'
      ? 'Advocates are speaking…'
      : phase === 'judges'
        ? 'Judges are deliberating…'
        : 'Finishing…';

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative aspect-square w-full">
        {/* guide ring */}
        <div className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-divider/60" />

        {/* center label */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">In session</span>
          <span className="text-sm text-neutral-300">{phaseText}</span>
          <span className="text-xs text-neutral-500">
            {done.size} / {ring.length} finished
          </span>
        </div>

        {ring.map((p, i) => {
          const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          const left = 50 + R * Math.cos(angle);
          const top = 50 + R * Math.sin(angle);
          return (
            <div
              key={p.key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <PersonaNode p={p} state={stateFor(p, done, phase)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
