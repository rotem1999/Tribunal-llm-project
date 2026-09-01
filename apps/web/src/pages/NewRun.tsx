import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ErrorCode,
  RunMode,
  type ChargeSheet,
  type ModelInfo,
  type PersonaInfo,
} from '@tribunal/shared-types';
import { getActiveChargeSheet } from '../api/chargeSheet';
import { codeOf } from '../api/errors';
import { getModels } from '../api/models';
import { getPersonas } from '../api/personas';
import { createRun } from '../api/runs';
import { ErrorNotice } from '../components/ErrorNotice';
import { ModelPicker } from '../components/ModelPicker';
import { ModeToggle } from '../components/ModeToggle';
import { Button, Card, Eyebrow, Switch } from '../components/ui';

/** Human label for a persona row in the Mode B picker list. */
function personaLabel(p: PersonaInfo): string {
  const role = p.side ? `${p.role} · ${p.side}` : p.role;
  return `${p.name} (${role})`;
}

/** New Run (SPEC §11): read-only active charge sheet, Mode toggle, model
 * picker(s) with free-default + paid opt-in, Run button. No upload/edit (D9). */
export function NewRun() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<ChargeSheet | null>(null);
  const [mode, setMode] = useState<RunMode>(RunMode.A_single);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [personas, setPersonas] = useState<PersonaInfo[]>([]);
  const [showPaid, setShowPaid] = useState(false);
  // Mode A: '' means "Auto". Mode B: personaKey → modelId (all required).
  const [modelSingle, setModelSingle] = useState('');
  const [modelByPersona, setModelByPersona] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  useEffect(() => {
    getActiveChargeSheet().then(setSheet).catch(() => undefined);
    getModels().then(setModels).catch(() => undefined);
    getPersonas().then(setPersonas).catch(() => undefined);
  }, []);

  const hasPaid = models.some((m) => !m.isFree);
  // Mode B can only start once every persona has a chosen model (SPEC §11).
  const allPicked =
    personas.length > 0 && personas.every((p) => modelByPersona[p.key]);
  const canRun =
    !running && (mode === RunMode.A_single || allPicked);

  async function run() {
    setRunning(true);
    setErrorCode(null);
    try {
      const { runId } = await createRun(
        mode === RunMode.A_single
          ? { mode, modelSingle: modelSingle || undefined }
          : { mode, modelByPersona },
      );
      navigate(`/runs/${runId}`);
    } catch (err) {
      setErrorCode(codeOf(err));
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-500">
            Mode
          </h2>
          {hasPaid && (
            <Switch
              checked={showPaid}
              onChange={setShowPaid}
              label="Show paid models"
            />
          )}
        </div>
        <ModeToggle value={mode} onChange={setMode} />

        {mode === RunMode.A_single ? (
          <div className="pt-2">
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                Model (optional)
              </span>
              <ModelPicker
                models={models}
                value={modelSingle}
                onChange={setModelSingle}
                showPaid={showPaid}
                allowAuto
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-neutral-500">
              Choose a model for each of the 7 personas.
            </p>
            {personas.map((p) => (
              <label key={p.key} className="block space-y-1.5">
                <span className="text-xs text-neutral-400">{personaLabel(p)}</span>
                <ModelPicker
                  id={`model-${p.key}`}
                  models={models}
                  value={modelByPersona[p.key] ?? ''}
                  onChange={(id) =>
                    setModelByPersona((prev) => ({ ...prev, [p.key]: id }))
                  }
                  showPaid={showPaid}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      {errorCode && <ErrorNotice code={errorCode} />}

      <div>
        <Button onClick={run} disabled={!canRun}>
          {running
            ? 'Running the tribunal…'
            : mode === RunMode.B_per_persona && !allPicked
              ? 'Pick a model for every persona'
              : 'Run tribunal'}
        </Button>
      </div>
    </div>
  );
}
