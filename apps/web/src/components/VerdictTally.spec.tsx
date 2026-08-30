import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictTally } from './VerdictTally';

describe('VerdictTally', () => {
  it('shows the leading count out of total and marks itself non-binding', () => {
    render(<VerdictTally tally={{ justified: 2, not_justified: 1 }} />);

    // 2 of 3 judges lead "justified".
    expect(screen.getByText(/2 of 3 judges:\s*justified/)).toBeInTheDocument();
    // SPEC/D5: explicitly no combined verdict.
    expect(
      screen.getByText(/the tribunal issues no combined verdict/i),
    ).toBeInTheDocument();
  });

  it('reflects a not-justified lead when it dominates', () => {
    render(<VerdictTally tally={{ justified: 1, not_justified: 2 }} />);
    expect(
      screen.getByText(/2 of 3 judges:\s*not justified/),
    ).toBeInTheDocument();
  });

  it('labels a tie as "split" rather than a winner', () => {
    render(<VerdictTally tally={{ justified: 1, not_justified: 1 }} />);
    expect(screen.getByText(/1 of 2 judges:\s*split/)).toBeInTheDocument();
  });

  it('never presents a winner or final/authoritative decision', () => {
    render(<VerdictTally tally={{ justified: 3, not_justified: 0 }} />);
    expect(screen.queryByText(/winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/final verdict/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authoritative/i)).not.toBeInTheDocument();
  });

  it('renders nothing when there is no tally', () => {
    const { container } = render(<VerdictTally tally={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
