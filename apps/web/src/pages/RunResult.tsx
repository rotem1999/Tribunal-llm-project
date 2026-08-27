import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RunStatus, Side, type RunDetail } from '@tribunal/shared-types';
import { ApiError } from '../api/client';
import { getRun } from '../api/runs';
import { EconomyPanel } from '../components/EconomyPanel';
import { SpeechCard } from '../components/SpeechCard';
import { Eyebrow } from '../components/ui';
import { VerdictCard } from '../components/VerdictCard';
import { VerdictTally } from '../components/VerdictTally';

/** Run Result (SPEC §11): 4 speeches, 3 verdicts, non-binding tally, economy. */
export function RunResult() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getRun(id)
      .then(setRun)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Could not load run.'),
      );
  }, [id]);

  if (error) return <p className="text-sm text-not-justified">{error}</p>;
  if (!run) return <p className="text-sm text-neutral-500">Loading run…</p>;

  const support = run.speeches.filter((s) => s.side === Side.support);
  const against = run.speeches.filter((s) => s.side === Side.against);

  return (
    <div className="space-y-10">
      <div>
        <Eyebrow>Run result</Eyebrow>
        <h1 className="mt-2 font-heading text-2xl font-medium">The verdicts</h1>
        {run.status === RunStatus.aborted_over_budget && (
          <p className="mt-2 text-sm text-not-justified">
            Run aborted over budget — partial results shown.
          </p>
        )}
      </div>

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
            <div className="text-xs text-neutral-400">Prosecution (against)</div>
            {against.map((s) => (
              <SpeechCard key={s.id} speech={s} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
          Judges
        </h2>
        <VerdictTally tally={run.verdictTally} />
        <div className="grid gap-4 md:grid-cols-3">
          {run.verdicts.map((v) => (
            <VerdictCard key={v.id} verdict={v} />
          ))}
        </div>
      </section>

      <section>
        <EconomyPanel economy={run.economy} />
      </section>
    </div>
  );
}
