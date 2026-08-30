import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Side } from '@tribunal/shared-types';
import { SpeechCard } from './SpeechCard';
import { makeSpeech } from '../test/fixtures';

describe('SpeechCard', () => {
  it('renders a support speech titled with the persona NAME and labelled "defense"', () => {
    const speech = makeSpeech({
      personaKey: 'support_1',
      personaName: 'Jon Snow',
      side: Side.support,
      content: 'The accused acted in self-defense.',
      model: 'meta-llama/llama-3-8b:free',
    });

    render(<SpeechCard speech={speech} />);

    // Title is the human name, not the persona key.
    expect(screen.getByText('Jon Snow')).toBeInTheDocument();
    expect(screen.queryByText('support_1')).not.toBeInTheDocument();
    expect(screen.getByText('defense')).toBeInTheDocument();
    expect(screen.queryByText('prosecution')).not.toBeInTheDocument();
    expect(
      screen.getByText('The accused acted in self-defense.'),
    ).toBeInTheDocument();
    expect(screen.getByText('meta-llama/llama-3-8b:free')).toBeInTheDocument();
  });

  it('is collapsed by default and expands on click (UX rules 1 & 4)', async () => {
    const user = userEvent.setup();
    const speech = makeSpeech({ personaName: 'Jon Snow', side: Side.support });
    render(<SpeechCard speech={speech} />);

    const toggle = screen.getByRole('button', { name: /Jon Snow/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders an against speech labelled "prosecution"', () => {
    const speech = makeSpeech({
      personaKey: 'against_2',
      personaName: 'Grey Worm',
      side: Side.against,
      content: 'The accused is at fault.',
    });

    render(<SpeechCard speech={speech} />);

    expect(screen.getByText('Grey Worm')).toBeInTheDocument();
    expect(screen.getByText('prosecution')).toBeInTheDocument();
    expect(screen.queryByText('defense')).not.toBeInTheDocument();
    expect(screen.getByText('The accused is at fault.')).toBeInTheDocument();
  });
});
