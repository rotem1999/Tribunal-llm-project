import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Decision, RunStatus, Side } from '@tribunal/shared-types';
import { RunResult } from './RunResult';
import { API_BASE, server } from '../test/server';
import {
  makeRunDetail,
  makeSpeech,
  makeVerdict,
} from '../test/fixtures';
import { renderWithProviders } from '../test/utils';

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
    server.use(
      http.get(`${API_BASE}/runs/run-1`, () =>
        HttpResponse.json(makeRunDetail()),
      ),
    );

    renderRun();

    // Scope to the Judges section (persona keys also appear in the economy table).
    const judges = within(
      (await screen.findByText('Judges')).closest('section') as HTMLElement,
    );

    // All three judges appear as independent verdicts.
    expect(judges.getByText('judge_one')).toBeInTheDocument();
    expect(judges.getByText('judge_two')).toBeInTheDocument();
    expect(judges.getByText('judge_three')).toBeInTheDocument();

    // Exactly three decision badges — one per verdict — no more, no fewer.
    const badges = judges.getAllByText(/^(justified|not justified)$/);
    expect(badges).toHaveLength(3);

    // The non-binding tally is shown.
    expect(
      screen.getByText(/the tribunal issues no combined verdict/i),
    ).toBeInTheDocument();

    // SPEC: there is never an authoritative/combined/final verdict element.
    expect(screen.queryByTestId('finalDecision')).not.toBeInTheDocument();
    expect(screen.queryByText(/final verdict/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^winner$/i)).not.toBeInTheDocument();
  });

  it('groups speeches into defense (support) and prosecution (against)', async () => {
    const run = makeRunDetail({
      speeches: [
        makeSpeech({
          id: 'sp-1',
          personaKey: 'advocate_support',
          side: Side.support,
          content: 'Defense argues justification here.',
        }),
        makeSpeech({
          id: 'sp-2',
          personaKey: 'advocate_against',
          side: Side.against,
          content: 'Prosecution argues fault here.',
        }),
      ],
    });
    server.use(
      http.get(`${API_BASE}/runs/run-1`, () => HttpResponse.json(run)),
    );

    renderRun();

    expect(
      await screen.findByText('Defense argues justification here.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Prosecution argues fault here.'),
    ).toBeInTheDocument();
    // Column headers present.
    expect(screen.getByText('Defense (support)')).toBeInTheDocument();
    expect(screen.getByText('Prosecution (against)')).toBeInTheDocument();
    // The support speech carries the "defense" badge; against carries "prosecution".
    expect(screen.getByText('defense')).toBeInTheDocument();
    expect(screen.getByText('prosecution')).toBeInTheDocument();
  });

  it('renders the economy panel for the run', async () => {
    server.use(
      http.get(`${API_BASE}/runs/run-1`, () =>
        HttpResponse.json(makeRunDetail()),
      ),
    );
    renderRun();
    expect(await screen.findByText('Economy')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Download JSON/ }),
    ).toBeInTheDocument();
  });

  it('shows an over-budget banner for an aborted run', async () => {
    server.use(
      http.get(`${API_BASE}/runs/run-1`, () =>
        HttpResponse.json(
          makeRunDetail({ status: RunStatus.aborted_over_budget }),
        ),
      ),
    );
    renderRun();
    expect(
      await screen.findByText(/Run aborted over budget/i),
    ).toBeInTheDocument();
  });

  it('surfaces an API error message when the run cannot be loaded', async () => {
    server.use(
      http.get(`${API_BASE}/runs/missing`, () =>
        HttpResponse.json({ message: 'Run not found.' }, { status: 404 }),
      ),
    );
    renderRun('missing');
    expect(await screen.findByText('Run not found.')).toBeInTheDocument();
  });

  it('renders all three verdict decisions even when unanimous', async () => {
    const run = makeRunDetail({
      verdicts: [
        makeVerdict({ id: 'v1', personaKey: 'judge_one', decision: Decision.justified }),
        makeVerdict({ id: 'v2', personaKey: 'judge_two', decision: Decision.justified }),
        makeVerdict({ id: 'v3', personaKey: 'judge_three', decision: Decision.justified }),
      ],
      verdictTally: { justified: 3, not_justified: 0 },
    });
    server.use(http.get(`${API_BASE}/runs/run-1`, () => HttpResponse.json(run)));

    renderRun();

    const judges = within(
      (await screen.findByText('Judges')).closest('section') as HTMLElement,
    );
    // Still three independent verdict badges — no collapsing into one.
    expect(judges.getAllByText(/^(justified|not justified)$/)).toHaveLength(3);
  });
});
