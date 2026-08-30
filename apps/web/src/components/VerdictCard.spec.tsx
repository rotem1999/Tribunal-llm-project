import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Decision } from '@tribunal/shared-types';
import { VerdictCard } from './VerdictCard';
import { makeVerdict } from '../test/fixtures';

describe('VerdictCard', () => {
  it('renders a justified verdict titled with the persona NAME, plus confidence/reasoning/model', () => {
    const verdict = makeVerdict({
      personaKey: 'judge_1',
      personaName: 'Presiding Justice',
      decision: Decision.justified,
      confidence: 84,
      reasoning: 'The conduct was proportionate to the threat.',
      model: 'anthropic/claude-3-haiku',
    });

    render(<VerdictCard verdict={verdict} />);

    expect(screen.getByText('Presiding Justice')).toBeInTheDocument();
    expect(screen.queryByText('judge_1')).not.toBeInTheDocument();
    expect(screen.getByText('justified')).toBeInTheDocument();
    expect(screen.getByText('confidence 84')).toBeInTheDocument();
    expect(
      screen.getByText('The conduct was proportionate to the threat.'),
    ).toBeInTheDocument();
    expect(screen.getByText('anthropic/claude-3-haiku')).toBeInTheDocument();
  });

  it('renders a not_justified verdict with the "not justified" label', () => {
    const verdict = makeVerdict({
      personaKey: 'judge_3',
      personaName: 'Justice Shamgar',
      decision: Decision.not_justified,
      confidence: 40,
    });

    render(<VerdictCard verdict={verdict} />);

    expect(screen.getByText('Justice Shamgar')).toBeInTheDocument();
    expect(screen.getByText('not justified')).toBeInTheDocument();
    expect(screen.queryByText('justified')).not.toBeInTheDocument();
    expect(screen.getByText('confidence 40')).toBeInTheDocument();
  });
});
