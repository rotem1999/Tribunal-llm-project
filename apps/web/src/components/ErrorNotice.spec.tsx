import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@tribunal/shared-types';
import { ErrorNotice } from './ErrorNotice';

/**
 * The user-safe error presenter (SPEC §12.1): a plain sentence keyed by the
 * stable code, with a quotable reference (run id + code) only for uncategorized
 * failures — and never a raw/technical string on screen.
 */
describe('ErrorNotice', () => {
  it('renders the friendly copy for a categorized code and NO reference line', () => {
    render(<ErrorNotice code={ErrorCode.OUT_OF_CREDITS} runId="run-123" />);

    expect(screen.getByText(/out of credits/i)).toBeInTheDocument();
    // A categorized, actionable failure never shows the quotable reference.
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/run-123/)).not.toBeInTheDocument();
  });

  it('renders the friendly line AND a reference (run id + code) for an uncategorized failure', () => {
    render(<ErrorNotice code={ErrorCode.INTERNAL} runId="run-123" />);

    expect(
      screen.getByText('Something went wrong. Please try again.'),
    ).toBeInTheDocument();
    const reference = screen.getByText(/Reference:/);
    expect(reference).toHaveTextContent('run-123');
    expect(reference).toHaveTextContent('INTERNAL');
  });

  it('exposes an alert role for assistive tech', () => {
    render(<ErrorNotice code={ErrorCode.RATE_LIMITED} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('never renders a raw / technical string, only the friendly copy', () => {
    const { container } = render(
      <ErrorNotice code={ErrorCode.MODEL_UNAVAILABLE} runId="run-9" />,
    );

    expect(
      screen.getByText(/couldn't reach a working AI model/i),
    ).toBeInTheDocument();
    // No stack, HTTP status dump, exception name, or provider output leaks in.
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Error:|Exception|stack|at \w+\.|http/i);
    // A categorized failure shows no reference either.
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });
});
