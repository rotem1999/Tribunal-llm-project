import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { RunMode, RunStatus } from '@tribunal/shared-types';
import { History } from './History';
import { API_BASE, server } from '../test/server';
import { makeRunSummary } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/utils';

describe('History', () => {
  it('renders a row per run with mode, status, tally and cost', async () => {
    server.use(
      http.get(`${API_BASE}/runs`, () =>
        HttpResponse.json([
          makeRunSummary({
            id: 'run-a',
            mode: RunMode.A_single,
            status: RunStatus.completed,
            verdictTally: { justified: 2, not_justified: 1 },
            totalCostUsd: 0,
          }),
          makeRunSummary({
            id: 'run-b',
            mode: RunMode.B_per_persona,
            status: RunStatus.failed,
            verdictTally: { justified: 0, not_justified: 3 },
            totalCostUsd: 0.004321,
          }),
        ]),
      ),
    );

    renderWithProviders(<History />, { route: '/history' });

    await screen.findByText('A_single');
    expect(screen.getByText('B_per_persona')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    // Tally rendered as justified/not_justified.
    expect(screen.getByText('2/1')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    // Cost formatting: zero → $0.00, non-zero → 6dp.
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('$0.004321')).toBeInTheDocument();
  });

  it('navigates to /runs/:id when a row is clicked', async () => {
    server.use(
      http.get(`${API_BASE}/runs`, () =>
        HttpResponse.json([makeRunSummary({ id: 'run-click' })]),
      ),
    );

    const { user } = renderWithProviders(
      <>
        <History />
        <LocationProbe />
      </>,
      { route: '/history' },
    );

    const modeCell = await screen.findByText('A_single');
    const row = modeCell.closest('tr') as HTMLElement;
    await user.click(within(row).getByText('A_single'));

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-click',
      );
    });
  });

  it('shows an empty-state message when there are no runs', async () => {
    server.use(http.get(`${API_BASE}/runs`, () => HttpResponse.json([])));

    renderWithProviders(<History />, { route: '/history' });

    expect(
      await screen.findByText(/No runs yet/i),
    ).toBeInTheDocument();
  });
});
