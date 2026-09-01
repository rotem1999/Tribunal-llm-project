import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelPicker } from './ModelPicker';
import { makeModels } from '../test/fixtures';

/** ModelPicker (SPEC §5.2/§11): free by default, paid on opt-in, the selected
 * model always visible, Mode A "Auto" option, per-1M price labels. */

const FREE_A = 'meta-llama/llama-3-8b:free';
const FREE_B = 'mistralai/mistral-7b:free';
const PAID = 'anthropic/claude-3-haiku';

function optionValues(): string[] {
  return within(screen.getByRole('combobox'))
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value);
}

describe('ModelPicker', () => {
  it('shows only free options when showPaid is false (paid id absent)', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value=""
        onChange={() => undefined}
        showPaid={false}
        allowAuto
      />,
    );
    const values = optionValues();
    expect(values).toContain(FREE_A);
    expect(values).toContain(FREE_B);
    expect(values).not.toContain(PAID);
  });

  it('reveals paid options when showPaid is true', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value=""
        onChange={() => undefined}
        showPaid
        allowAuto
      />,
    );
    const values = optionValues();
    expect(values).toContain(FREE_A);
    expect(values).toContain(PAID);
  });

  it('keeps a selected paid model visible even when showPaid is false', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value={PAID}
        onChange={() => undefined}
        showPaid={false}
      />,
    );
    // The chosen paid model must never vanish just because paid is hidden.
    expect(optionValues()).toContain(PAID);
  });

  it('renders the "Auto (top free model)" option when allowAuto is set', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value=""
        onChange={() => undefined}
        showPaid={false}
        allowAuto
      />,
    );
    expect(
      screen.getByRole('option', { name: /Auto \(top free model\)/ }),
    ).toBeInTheDocument();
  });

  it('shows a disabled "Choose a model…" placeholder when allowAuto is not set (Mode B)', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value=""
        onChange={() => undefined}
        showPaid={false}
      />,
    );
    expect(
      screen.queryByRole('option', { name: /Auto \(top free model\)/ }),
    ).not.toBeInTheDocument();
    const placeholder = screen.getByRole('option', {
      name: /Choose a model/,
    }) as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });

  it('labels free models "free" and paid models with a per-1M price', () => {
    render(
      <ModelPicker
        models={makeModels()}
        value=""
        onChange={() => undefined}
        showPaid
        allowAuto
      />,
    );
    // Free model → "free".
    expect(
      screen.getByRole('option', { name: new RegExp(`${FREE_A} — free`) }),
    ).toBeInTheDocument();
    // Paid model → "$0.25 / $1.25 per 1M".
    const paidOption = screen.getByRole('option', {
      name: new RegExp(`${PAID} —`),
    });
    expect(paidOption.textContent).toMatch(/per 1M/);
    expect(paidOption.textContent).toContain('$0.25 / $1.25 per 1M');
  });
});
