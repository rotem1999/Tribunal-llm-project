import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RunMode,
  type ChargeSheet,
  type FreeModel,
} from '@tribunal/shared-types';
import { getActiveChargeSheet } from '../api/chargeSheet';
import { ApiError } from '../api/client';
import { getFreeModels } from '../api/models';
import { createRun } from '../api/runs';
import { ModeToggle } from '../components/ModeToggle';
import { Button, Card, Eyebrow } from '../components/ui';

/** New Run (SPEC §11): read-only active charge sheet, Mode toggle, Mode-A model
 * picker, Run button. No upload/edit control (D9). */
export function NewRun() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<ChargeSheet | null>(null);
  const [mode, setMode] = useState<RunMode>(RunMode.A_single);
  const [models, setModels] = useState<FreeModel[]>([]);
  const [modelSingle, setModelSingle] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveChargeSheet().then(setSheet).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mode === RunMode.A_single && models.length === 0) {
      getFreeModels().then(setModels).catch(() => undefined);
    }
  }, [mode, models.length]);

  async function run() {
    setRunning(true);
    setError('');
    try {
      const { runId } = await createRun({
        mode,
        modelSingle:
          mode === RunMode.A_single && modelSingle ? modelSingle : undefined,
      });
      navigate(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Run failed.');
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>New run</Eyebrow>
        <h1 className="mt-2 font-heading text-2xl font-medium">
          Convene the tribunal
        </h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
          Active charge sheet
        </h2>
        <Card className="p-4">
          {sheet ? (
            <>
              <div className="text-sm font-medium text-text">{sheet.title}</div>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-300">
                {sheet.content}
              </pre>
            </>
          ) : (
            <div className="text-sm text-neutral-500">Loading…</div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
          Mode
        </h2>
        <ModeToggle value={mode} onChange={setMode} />
        {mode === RunMode.A_single && (
          <div className="pt-2">
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                Model (optional)
              </span>
              <select
                value={modelSingle}
                onChange={(e) => setModelSingle(e.target.value)}
                className="w-full rounded border border-neutral-800 bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="">Auto (top free model)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {error && (
        <p className="text-sm text-not-justified" role="alert">
          {error}
        </p>
      )}

      <div>
        <Button onClick={run} disabled={running}>
          {running ? 'Running the tribunal…' : 'Run tribunal'}
        </Button>
        {running && (
          <p className="mt-2 text-xs text-neutral-500">
            7 model calls — this can take a little while.
          </p>
        )}
      </div>
    </div>
  );
}
