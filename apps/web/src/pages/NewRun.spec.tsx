import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse, delay, type RequestHandler } from 'msw';
import { describe, expect, it } from 'vitest';
import { NewRun } from './NewRun';
import { API_BASE, server } from '../test/server';
import { makeChargeSheet, makeModels, makePersonas } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/utils';

/** NewRun now fetches GET /models (free + paid) and GET /personas (SPEC §5.2/§11). */
function handlers(extra: RequestHandler[] = []) {
  server.use(
    http.get(`${API_BASE}/charge-sheet`, () =>
      HttpResponse.json(makeChargeSheet({ title: 'People v. Accused' })),
    ),
    http.get(`${API_BASE}/models`, () => HttpResponse.json(makeModels())),
    http.get(`${API_BASE}/personas`, () => HttpResponse.json(makePersonas())),
    ...extra,
  );
}

const PAID_ID = 'anthropic/claude-3-haiku';
const FREE_ID = 'mistralai/mistral-7b:free';

describe('NewRun', () => {
  it('shows the active charge sheet read-only (no upload/edit control)', async () => {
    handlers();
    renderWithProviders(<NewRun />, { route: '/new' });

    expect(await screen.findByText('People v. Accused')).toBeInTheDocument();
    expect(
      screen.getByText('The accused did the thing on the date in question.'),
    ).toBeInTheDocument();

    // SPEC D9: the charge sheet is fixed — NO editable textbox/textarea or file
    // upload. In Mode A the only interactive control is the model <select>.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('shows ONE model picker in Mode A, and one per persona (7) in Mode B', async () => {
    handlers();
    const { user } = renderWithProviders(<NewRun />, { route: '/new' });

    await screen.findByText('People v. Accused');

    // Mode A (default): a single model <select> combobox.
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Switch to "Model per persona" — one picker per persona (all 7).
    await user.click(
      screen.getByRole('button', { name: /Model per persona/ }),
    );
    const pickers = await screen.findAllByRole('combobox');
    expect(pickers).toHaveLength(7);
  });

  it('disables the Run button while a run is in flight, then navigates to /runs/:id', async () => {
    handlers([
      http.post(`${API_BASE}/runs`, async () => {
        await delay(50);
        return HttpResponse.json({ runId: 'run-xyz' });
      }),
    ]);

    const { user } = renderWithProviders(
      <>
        <NewRun />
        <LocationProbe />
      </>,
      { route: '/new' },
    );

    await screen.findByText('People v. Accused');

    const runButton = screen.getByRole('button', { name: 'Run tribunal' });
    expect(runButton).toBeEnabled();

    await user.click(runButton);

    const runningButton = await screen.findByRole('button', {
      name: /Running the tribunal/,
    });
    expect(runningButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-xyz',
      );
    });
  });

  it('surfaces an ApiError message when the run fails and re-enables the button', async () => {
    handlers([
      http.post(`${API_BASE}/runs`, () =>
        HttpResponse.json({ message: 'Over the cost ceiling.' }, { status: 400 }),
      ),
    ]);

    const { user } = renderWithProviders(<NewRun />, { route: '/new' });
    await screen.findByText('People v. Accused');

    await user.click(screen.getByRole('button', { name: 'Run tribunal' }));

    expect(
      await screen.findByText('Over the cost ceiling.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run tribunal' })).toBeEnabled();
  });

  it('submits the selected single model (Mode A) and navigates', async () => {
    let sentBody: unknown = null;
    handlers([
      http.post(`${API_BASE}/runs`, async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ runId: 'run-2' });
      }),
    ]);

    const { user } = renderWithProviders(
      <>
        <NewRun />
        <LocationProbe />
      </>,
      { route: '/new' },
    );

    await screen.findByText('People v. Accused');
    await user.selectOptions(screen.getByRole('combobox'), FREE_ID);
    await user.click(screen.getByRole('button', { name: 'Run tribunal' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-2',
      );
    });
    expect(sentBody).toMatchObject({
      mode: 'A_single',
      modelSingle: FREE_ID,
    });
  });

  it('Mode B: Run is disabled and labelled until every persona has a model, then submits modelByPersona', async () => {
    let sentBody: unknown = null;
    handlers([
      http.post(`${API_BASE}/runs`, async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ runId: 'run-b' });
      }),
    ]);

    const { user } = renderWithProviders(
      <>
        <NewRun />
        <LocationProbe />
      </>,
      { route: '/new' },
    );

    await screen.findByText('People v. Accused');
    await user.click(
      screen.getByRole('button', { name: /Model per persona/ }),
    );

    const pickers = await screen.findAllByRole('combobox');
    expect(pickers).toHaveLength(7);

    // Before any pick: the Run button is disabled and carries the prompt label.
    const prompt = screen.getByRole('button', {
      name: 'Pick a model for every persona',
    });
    expect(prompt).toBeDisabled();

    // Pick a model for each persona; the button stays disabled until the last one.
    const keys = makePersonas().map((p) => p.key);
    for (let i = 0; i < pickers.length; i++) {
      await user.selectOptions(pickers[i], FREE_ID);
      if (i < pickers.length - 1) {
        expect(
          screen.getByRole('button', {
            name: 'Pick a model for every persona',
          }),
        ).toBeDisabled();
      }
    }

    const runButton = screen.getByRole('button', { name: 'Run tribunal' });
    expect(runButton).toBeEnabled();
    await user.click(runButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-b',
      );
    });
    expect(sentBody).toMatchObject({
      mode: 'B_per_persona',
      modelByPersona: Object.fromEntries(keys.map((k) => [k, FREE_ID])),
    });
  });

  it('shows the "Show paid models" toggle when a paid model exists, and it reveals the paid option', async () => {
    handlers();
    const { user } = renderWithProviders(<NewRun />, { route: '/new' });

    await screen.findByText('People v. Accused');

    // The paid option is hidden by default (free-only).
    const picker = screen.getByRole('combobox');
    expect(
      within(picker).queryByRole('option', { name: new RegExp(PAID_ID) }),
    ).not.toBeInTheDocument();

    // The checkbox appears because makeModels() includes a paid model.
    const toggle = screen.getByRole('checkbox', { name: /Show paid models/ });
    await user.click(toggle);

    // Now the paid model is offered.
    expect(
      within(screen.getByRole('combobox')).getByRole('option', {
        name: new RegExp(PAID_ID),
      }),
    ).toBeInTheDocument();
  });
});
