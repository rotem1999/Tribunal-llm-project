import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictTally } from './VerdictTally';

describe('VerdictTally', () => {
  it('shows a bare count of both decisions', () => {
    render(<VerdictTally tally={{ justified: 2, not_justified: 1 }} />);
    expect(screen.getByText('Justified 2')).toBeInTheDocument();
    expect(screen.getByText('Not justified 1')).toBeInTheDocument();
  });

  it('carries no disclaimer, winner, or final-verdict copy (UX rule 1: trim AI statements)', () => {
    render(<VerdictTally tally={{ justified: 3, not_justified: 0 }} />);
    expect(screen.queryByText(/no combined verdict/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/final verdict/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authoritative/i)).not.toBeInTheDocument();
  });

  it('renders nothing when there is no tally', () => {
    const { container } = render(<VerdictTally tally={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
