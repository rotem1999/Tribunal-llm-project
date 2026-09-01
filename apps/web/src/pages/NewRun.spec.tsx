import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay, type RequestHandler } from 'msw';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@tribunal/shared-types';
import { NewRun } from './NewRun';
import { API_BASE, server } from '../test/server';
import { makeChargeSheet, makeFreeModels } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/utils';

function handlers(extra: RequestHandler[] = []) {
  server.use(
    http.get(`${API_BASE}/charge-sheet`, () =>
      HttpResponse.json(makeChargeSheet({ title: 'People v. Accused' })),
    ),
    http.get(`${API_BASE}/models/free`, () =>
      HttpResponse.json(makeFreeModels()),
    ),
    ...extra,
  );
}

describe('NewRun', () => {
  it('shows the active charge sheet read-only (no upload/edit control)', async () => {
    handlers();
    renderWithProviders(<NewRun />, { route: '/new' });

    // Title + content appear.
    expect(await screen.findByText('People v. Accused')).toBeInTheDocument();
    expect(
      screen.getByText('The accused did the thing on the date in question.'),
    ).toBeInTheDocument();

    // SPEC D9: the charge sheet is fixed — there is NO editable textbox/textarea
    // or file upload to change it. The only interactive control is the model
    // <select> (a combobox), never a textbox.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      document.querySelector('textarea'),
    ).toBeNull();
    expect(
      document.querySelector('input[type="file"]'),
    ).toBeNull();
  });

  it('shows the Mode-A model picker only in single-model mode', async () => {
    handlers();
    const { user } = renderWithProviders(<NewRun />, { route: '/new' });

    await screen.findByText('People v. Accused');

    // Mode A is the default: the model <select> combobox is present.
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Switch to "Model per persona" — the picker disappears.
    await user.click(
      screen.getByRole('button', { name: /Model per persona/ }),
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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

    // While in flight the button flips to disabled + a running label.
    const runningButton = await screen.findByRole('button', {
      name: /Running the tribunal/,
    });
    expect(runningButton).toBeDisabled();

    // On completion the page navigates to the new run.
    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-xyz',
      );
    });
  });

  it('surfaces the friendly ErrorNotice copy when the run fails and re-enables the button', async () => {
    handlers([
      http.post(`${API_BASE}/runs`, () =>
        HttpResponse.json(
          {
            statusCode: 400,
            code: ErrorCode.INVALID_INPUT,
            message: 'Over the cost ceiling.',
          },
          { status: 400 },
        ),
      ),
    ]);

    const { user } = renderWithProviders(<NewRun />, { route: '/new' });
    await screen.findByText('People v. Accused');

    await user.click(screen.getByRole('button', { name: 'Run tribunal' }));

    // The UI renders the code-keyed friendly copy, never the raw backend message.
    expect(
      await screen.findByText(/weren't entered correctly/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Over the cost ceiling.')).not.toBeInTheDocument();
    // Failure path resets `running`, so the button is usable again.
    expect(screen.getByRole('button', { name: 'Run tribunal' })).toBeEnabled();
  });

  it('submits the selected single model and navigates', async () => {
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
    // Pick a specific free model from the picker.
    await user.selectOptions(
      screen.getByRole('combobox'),
      'mistralai/mistral-7b:free',
    );
    await user.click(screen.getByRole('button', { name: 'Run tribunal' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/runs/run-2',
      );
    });
    expect(sentBody).toMatchObject({
      mode: 'A_single',
      modelSingle: 'mistralai/mistral-7b:free',
    });
  });
});
