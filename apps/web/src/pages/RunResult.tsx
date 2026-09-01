import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ErrorCode,
  RunStatus,
  Side,
  type PersonaInfo,
  type RunDetail,
  type RunProgress,
} from '@tribunal/shared-types';
import { codeOf } from '../api/errors';
import { getPersonas } from '../api/personas';
import { getRun, getRunProgress } from '../api/runs';
import { EconomyPanel } from '../components/EconomyPanel';
import { ErrorNotice } from '../components/ErrorNotice';
import { SpeechCard } from '../components/SpeechCard';
import { TribunalCircle } from '../components/TribunalCircle';
import { VerdictCard } from '../components/VerdictCard';
import { VerdictTally } from '../components/VerdictTally';
import { Caret } from '../components/ui';

const TERMINAL = new Set<RunStatus>([
  RunStatus.completed,
  RunStatus.failed,
  RunStatus.aborted_over_budget,
]);

type Tab = 'verdict' | 'economy';

/** Segmented tab bar — self-evident, no instructions (UX rule 4). */
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'verdict', label: 'Verdict' },
    { id: 'economy', label: 'Economy' },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex rounded-lg border border-divider p-0.5"
    >
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-accent/10 text-accent'
                : 'text-neutral-400 hover:text-text'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Run Result (SPEC §11): while running, poll progress and show the live tribunal
 * circle; on a terminal status, load the full run and show a two-tab view —
 * Verdict (judges first, then advocates) and Economy. Cards are collapsible.
 */
export function RunResult() {
  const { id } = useParams<{ id: string }>();
  const [personas, setPersonas] = useState<PersonaInfo[]>([]);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<ErrorCode | null>(null);
  const [tab, setTab] = useState<Tab>('verdict');
  // The 3 judge cards share one open/closed state (SPEC §11): all readable or
  // all cut — there is no per-judge toggle.
  const [judgesOpen, setJudgesOpen] = useState(false);

  useEffect(() => {
    getPersonas().then(setPersonas).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const p = await getRunProgress(id as string);
        if (!active) return;
        setProgress(p);
        if (TERMINAL.has(p.status)) {
          const full = await getRun(id as string);
          if (!active) return;
          setRun(full);
          return;
        }
      } catch (e) {
        if (!active) return;
        setLoadErrorCode(codeOf(e));
        return;
      }
      timer = setTimeout(poll, 1500);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (loadErrorCode && !run)
    return <ErrorNotice code={loadErrorCode} runId={id} />;

  // --- Still running: live animation (UX rule 3: immediate, live feedback) ---
  if (!run) {
    return (
      <div className="space-y-10">
        <h1 className="font-heading text-2xl font-medium">
          The tribunal is convening
        </h1>
        {progress && personas.length > 0 ? (
          <TribunalCircle
            personas={personas}
            done={new Set(progress.completedPersonaKeys)}
            phase={progress.phase}
          />
        ) : (
          <p className="text-sm text-neutral-500">Preparing the tribunal…</p>
        )}
      </div>
    );
  }

  const support = run.speeches.filter((s) => s.side === Side.support);
  const against = run.speeches.filter((s) => s.side === Side.against);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">The verdicts</h1>
        <TabBar tab={tab} onChange={setTab} />
      </div>

      {run.status === RunStatus.aborted_over_budget && (
        <p className="text-sm text-not-justified">
          This run stopped early to stay within budget — partial results are shown.
        </p>
      )}
      {run.status === RunStatus.failed && (
        <ErrorNotice code={run.errorCode} runId={run.id} />
      )}
      {run.status === RunStatus.completed &&
        run.errorCode === ErrorCode.VERDICT_UNREADABLE && (
          <ErrorNotice
            code={run.errorCode}
            className="text-sm text-neutral-400"
          />
        )}

      {tab === 'verdict' ? (
        <>
          {run.verdicts.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                  Judges
                </h2>
                <div className="flex items-center gap-3">
                  <VerdictTally tally={run.verdictTally} />
                  <button
                    type="button"
                    onClick={() => setJudgesOpen((o) => !o)}
                    aria-expanded={judgesOpen}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral-300 transition-colors hover:bg-accent/5"
                  >
                    {judgesOpen ? 'Collapse all' : 'Expand all'}
                    <Caret open={judgesOpen} />
                  </button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {run.verdicts.map((v) => (
                  <VerdictCard key={v.id} verdict={v} open={judgesOpen} />
                ))}
              </div>
            </section>
          )}

          {run.speeches.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                Advocates
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="text-xs text-accent-300">Defense (support)</div>
                  {support.map((s) => (
                    <SpeechCard key={s.id} speech={s} />
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="text-xs text-neutral-400">
                    Prosecution (against)
                  </div>
                  {against.map((s) => (
                    <SpeechCard key={s.id} speech={s} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <EconomyPanel economy={run.economy} />
      )}
    </div>
  );
}
