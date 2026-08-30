import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Decision } from '@tribunal/shared-types';
import { VerdictCard } from './VerdictCard';
import { makeVerdict } from '../test/fixtures';

describe('VerdictCard', () => {
  it('renders a justified verdict with confidence, reasoning, model and persona', () => {
    const verdict = makeVerdict({
      personaKey: 'judge_one',
      decision: Decision.justified,
      confidence: 84,
      reasoning: 'The conduct was proportionate to the threat.',
      model: 'anthropic/claude-3-haiku',
    });

    render(<VerdictCard verdict={verdict} />);

    expect(screen.getByText('judge_one')).toBeInTheDocument();
    // Decision badge is the exact lowercased label.
    expect(screen.getByText('justified')).toBeInTheDocument();
    expect(screen.getByText('confidence 84')).toBeInTheDocument();
    expect(
      screen.getByText('The conduct was proportionate to the threat.'),
    ).toBeInTheDocument();
    expect(screen.getByText('anthropic/claude-3-haiku')).toBeInTheDocument();
  });

  it('renders a not_justified verdict with the "not justified" label', () => {
    const verdict = makeVerdict({
      personaKey: 'judge_three',
      decision: Decision.not_justified,
      confidence: 40,
    });

    render(<VerdictCard verdict={verdict} />);

    expect(screen.getByText('judge_three')).toBeInTheDocument();
    expect(screen.getByText('not justified')).toBeInTheDocument();
    // Must NOT render the bare "justified" label for a not_justified verdict.
    expect(screen.queryByText('justified')).not.toBeInTheDocument();
    expect(screen.getByText('confidence 40')).toBeInTheDocument();
  });
});
