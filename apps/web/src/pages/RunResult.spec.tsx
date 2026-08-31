import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Decision, RunStatus, Side } from '@tribunal/shared-types';
import { RunResult } from './RunResult';
import { API_BASE, server } from '../test/server';
import {
  makePersonas,
  makeProgress,
  makeRunDetail,
  makeSpeech,
  makeVerdict,
} from '../test/fixtures';
import { renderWithProviders } from '../test/utils';

/**
 * Register the endpoints the page needs: the persona roster + a (terminal)
 * progress poll so the page loads the full run, then the run itself.
 */
function runHandlers(
  run = makeRunDetail(),
  progress = makeProgress({ status: run.status }),
) {
  server.use(
    http.get(`${API_BASE}/personas`, () => HttpResponse.json(makePersonas())),
    http.get(`${API_BASE}/runs/${run.id}/progress`, () =>
      HttpResponse.json(progress),
    ),
    http.get(`${API_BASE}/runs/${run.id}`, () => HttpResponse.json(run)),
  );
}

function renderRun(runId = 'run-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/runs/:id" element={<RunResult />} />
    </Routes>,
    { route: `/runs/${runId}` },
  );
}

describe('RunResult', () => {
  it('renders exactly 3 verdicts, the non-binding tally, and NO combined/final verdict', async () => {
    runHandlers();
    renderRun();

    const judges = within(
      (await screen.findByText('Judges')).closest('section') as HTMLElement,
    );

    // All three judges appear by NAME as independent verdicts.
    expect(judges.getByText('Presiding Justice')).toBeInTheDocument();
    expect(judges.getByText('Justice Elon')).toBeInTheDocument();
    expect(judges.getByText('Justice Shamgar')).toBeInTheDocument();

    const badges = judges.getAllByText(/^(justified|not justified)$/);
    expect(badges).toHaveLength(3);

    // Non-binding tally shown as a bare count — no disclaimer copy (UX rule 1).
    expect(judges.getByText('Justified 2')).toBeInTheDocument();
    expect(judges.getByText('Not justified 1')).toBeInTheDocument();

    expect(screen.queryByTestId('finalDecision')).not.toBeInTheDocument();
    expect(screen.queryByText(/final verdict/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^winner$/i)).not.toBeInTheDocument();
  });

  it('expands/collapses ALL judge cards with a single group control (no per-judge toggle)', async () => {
    runHandlers();
    const { user } = renderRun();

    const judges = within(
      (await screen.findByText('Judges')).closest('section') as HTMLElement,
    );

    // Exactly one expand/collapse control governs all three judges.
    const toggle = judges.getByRole('button', { name: /expand all/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(judges.queryByRole('button', { name: /collapse all/i })).toBeNull();

    // Opening it flips the whole group to expanded — one control, all cards.
    await user.click(toggle);
    const collapse = judges.getByRole('button', { name: /collapse all/i });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(judges.queryByRole('button', { name: /expand all/i })).toBeNull();
  });

  it('groups speeches into defense (support) and prosecution (against)', async () => {
    const run = makeRunDetail({
      speeches: [
        makeSpeech({
          id: 'sp-1',
          personaKey: 'support_1',
          personaName: 'Jon Snow',
          side: Side.support,
          content: 'Defense argues justification here.',
        }),
        makeSpeech({
          id: 'sp-2',
          personaKey: 'against_1',
          personaName: 'Daenerys Targaryen',
          side: Side.against,
          content: 'Prosecution argues fault here.',
        }),
      ],
    });
    runHandlers(run);
    renderRun();

    expect(
      await screen.findByText('Defense argues justification here.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Prosecution argues fault here.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Defense (support)')).toBeInTheDocument();
    expect(screen.getByText('Prosecution (against)')).toBeInTheDocument();
    expect(screen.getByText('defense')).toBeInTheDocument();
    expect(screen.getByText('prosecution')).toBeInTheDocument();
  });

  it('shows the economy panel on the Economy tab (not the default Verdict tab)', async () => {
    runHandlers();
    const { user } = renderRun();
    // Default tab is Verdict; the economy download is not shown yet.
    await screen.findByText('Judges');
    expect(
      screen.queryByRole('button', { name: /Download JSON/ }),
    ).not.toBeInTheDocument();
    // Switch to the Economy tab.
    await user.click(screen.getByRole('tab', { name: 'Economy' }));
    expect(
      screen.getByRole('button', { name: /Download JSON/ }),
    ).toBeInTheDocument();
  });

  it('shows an over-budget banner for an aborted run', async () => {
    runHandlers(makeRunDetail({ status: RunStatus.aborted_over_budget }));
    renderRun();
    expect(
      await screen.findByText(/Run aborted over budget/i),
    ).toBeInTheDocument();
  });

  it('shows a failure banner (with the error) for a failed run', async () => {
    runHandlers(
      makeRunDetail({
        status: RunStatus.failed,
        error: 'No free models are available for your OpenRouter account.',
        speeches: [],
        verdicts: [],
      }),
    );
    renderRun();
    expect(
      await screen.findByText(/The run could not complete/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No free models are available/i),
    ).toBeInTheDocument();
  });

  it('surfaces an API error message when the run cannot be loaded', async () => {
    server.use(
      http.get(`${API_BASE}/personas`, () => HttpResponse.json(makePersonas())),
      http.get(`${API_BASE}/runs/missing/progress`, () =>
        HttpResponse.json({ message: 'Run not found.' }, { status: 404 }),
      ),
    );
    renderRun('missing');
    expect(await screen.findByText('Run not found.')).toBeInTheDocument();
  });

  it('shows the live tribunal circle while a run is still in progress', async () => {
    const run = makeRunDetail();
    server.use(
      http.get(`${API_BASE}/personas`, () => HttpResponse.json(makePersonas())),
      http.get(`${API_BASE}/runs/${run.id}/progress`, () =>
        HttpResponse.json(
          makeProgress({
            status: RunStatus.running,
            phase: 'advocates',
            completedPersonaKeys: ['support_1'],
          }),
        ),
      ),
      http.get(`${API_BASE}/runs/${run.id}`, () => HttpResponse.json(run)),
    );
    renderRun();

    expect(
      await screen.findByText(/The tribunal is convening/i),
    ).toBeInTheDocument();
    // Roster names appear in the circle; 1 of 7 finished.
    expect(screen.getByText('Jon Snow')).toBeInTheDocument();
    expect(screen.getByText('1 / 7 finished')).toBeInTheDocument();
  });

  it('renders all three verdict decisions even when unanimous', async () => {
    const run = makeRunDetail({
      verdicts: [
        makeVerdict({ id: 'v1', personaKey: 'judge_1', personaName: 'Presiding Justice', decision: Decision.justified }),
        makeVerdict({ id: 'v2', personaKey: 'judge_2', personaName: 'Justice Elon', decision: Decision.justified }),
        makeVerdict({ id: 'v3', personaKey: 'judge_3', personaName: 'Justice Shamgar', decision: Decision.justified }),
      ],
      verdictTally: { justified: 3, not_justified: 0 },
    });
    runHandlers(run);
    renderRun();

    const judges = within(
      (await screen.findByText('Judges')).closest('section') as HTMLElement,
    );
    expect(judges.getAllByText(/^(justified|not justified)$/)).toHaveLength(3);
  });
});
