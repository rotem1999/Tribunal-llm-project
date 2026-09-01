import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders the reasoning text under a "Reasoning" section label for a non-truncated verdict', () => {
    const verdict = makeVerdict({
      truncated: false,
      reasoning: 'The conduct was proportionate to the threat.',
    });

    render(<VerdictCard verdict={verdict} />);

    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(
      screen.getByText('The conduct was proportionate to the threat.'),
    ).toBeInTheDocument();
  });

  it('shows a recess placeholder (not the reasoning) for a truncated verdict, keeping the decision badge and confidence', () => {
    const verdict = makeVerdict({
      truncated: true,
      decision: Decision.not_justified,
      confidence: 55,
      reasoning: 'SHOULD NOT SHOW — this opinion was cut off.',
    });

    render(<VerdictCard verdict={verdict} />);

    // Recess placeholder replaces the opinion.
    expect(screen.getByText(/recess/i)).toBeInTheDocument();
    expect(
      screen.getByText(/stepped out for a brief recess/i),
    ).toBeInTheDocument();
    // The raw/garbled reasoning is NOT shown.
    expect(
      screen.queryByText('SHOULD NOT SHOW — this opinion was cut off.'),
    ).not.toBeInTheDocument();
    // Decision badge + confidence still stand.
    expect(screen.getByText('not justified')).toBeInTheDocument();
    expect(screen.getByText('confidence 55')).toBeInTheDocument();
  });

  it('renders a collapsible "Model\'s reasoning" subsection (hidden until clicked) when modelReasoning is present (§5.4)', async () => {
    const user = userEvent.setup();
    const verdict = makeVerdict({
      modelReasoning: 'The model weighed X against Y.',
    });

    render(<VerdictCard verdict={verdict} />);

    // The control is present, but the reasoning text starts collapsed.
    const control = screen.getByText(/model's reasoning/i);
    expect(control).toBeInTheDocument();
    expect(
      screen.queryByText('The model weighed X against Y.'),
    ).not.toBeInTheDocument();

    // Clicking the control reveals the reasoning text.
    await user.click(control);
    expect(
      screen.getByText('The model weighed X against Y.'),
    ).toBeInTheDocument();
  });

  it('renders NO "Model\'s reasoning" control when the verdict has no modelReasoning', () => {
    render(<VerdictCard verdict={makeVerdict()} />);
    expect(screen.queryByText(/model's reasoning/i)).not.toBeInTheDocument();
  });
});
