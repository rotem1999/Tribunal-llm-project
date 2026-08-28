import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EconomyPanel } from './EconomyPanel';
import { makeEconomy } from '../test/fixtures';

describe('EconomyPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a per-persona row for each persona with tokens and cost', () => {
    render(<EconomyPanel economy={makeEconomy()} />);

    expect(screen.getByText('advocate_support')).toBeInTheDocument();
    expect(screen.getByText('judge_one')).toBeInTheDocument();
    // judge_one has a non-zero cost formatted to 6dp.
    expect(screen.getByText('$0.001234')).toBeInTheDocument();
    // advocate_support token count.
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders a zero cost as "$0.00 (free)"', () => {
    render(<EconomyPanel economy={makeEconomy()} />);
    // advocate_support costUsd is 0.
    expect(screen.getByText('$0.00 (free)')).toBeInTheDocument();
  });

  it('renders the grand totals row', () => {
    render(<EconomyPanel economy={makeEconomy()} />);
    const totalCell = screen.getByText('Total');
    const totalRow = totalCell.closest('tr');
    expect(totalRow).not.toBeNull();
    const row = within(totalRow as HTMLElement);
    expect(row.getByText('1440')).toBeInTheDocument();
    expect(row.getByText('$0.003702')).toBeInTheDocument();
  });

  it('renders the per-model rollup line', () => {
    render(<EconomyPanel economy={makeEconomy()} />);
    expect(
      screen.getByText(/meta-llama\/llama-3-8b:free ×4 \(600 tok\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/anthropic\/claude-3-haiku ×3 \(840 tok\)/),
    ).toBeInTheDocument();
  });

  it('exposes a Download JSON control that triggers a JSON blob download', async () => {
    const user = userEvent.setup();

    let capturedBlob: Blob | null = null;
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((obj: Blob | MediaSource) => {
        capturedBlob = obj as Blob;
        return 'blob:mock-url';
      });
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    // Capture the anchor the component builds for the download.
    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string, options?: ElementCreationOptions) => {
        const el = realCreateElement(tagName, options);
        if (tagName === 'a') anchor = el as HTMLAnchorElement;
        return el;
      },
    );

    const economy = makeEconomy({ runId: 'run-download' });
    render(<EconomyPanel economy={economy} />);

    const button = screen.getByRole('button', { name: /Download JSON/ });
    await user.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    // The object URL is built from a JSON blob of the economy.
    expect(capturedBlob).toBeInstanceOf(Blob);
    expect((capturedBlob as unknown as Blob).type).toBe('application/json');

    // The anchor points at the object URL and downloads a run-scoped filename.
    expect(anchor).not.toBeNull();
    expect((anchor as unknown as HTMLAnchorElement).href).toContain(
      'blob:mock-url',
    );
    expect((anchor as unknown as HTMLAnchorElement).download).toBe(
      'run-run-download.json',
    );
  });
});
