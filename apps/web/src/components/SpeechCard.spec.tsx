import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Side } from '@tribunal/shared-types';
import { SpeechCard } from './SpeechCard';
import { makeSpeech } from '../test/fixtures';

describe('SpeechCard', () => {
  it('renders a support speech labelled "defense"', () => {
    const speech = makeSpeech({
      personaKey: 'advocate_support',
      side: Side.support,
      content: 'The accused acted in self-defense.',
      model: 'meta-llama/llama-3-8b:free',
    });

    render(<SpeechCard speech={speech} />);

    expect(screen.getByText('advocate_support')).toBeInTheDocument();
    expect(screen.getByText('defense')).toBeInTheDocument();
    expect(screen.queryByText('prosecution')).not.toBeInTheDocument();
    expect(
      screen.getByText('The accused acted in self-defense.'),
    ).toBeInTheDocument();
    expect(screen.getByText('meta-llama/llama-3-8b:free')).toBeInTheDocument();
  });

  it('renders an against speech labelled "prosecution"', () => {
    const speech = makeSpeech({
      personaKey: 'advocate_against',
      side: Side.against,
      content: 'The accused is at fault.',
    });

    render(<SpeechCard speech={speech} />);

    expect(screen.getByText('advocate_against')).toBeInTheDocument();
    expect(screen.getByText('prosecution')).toBeInTheDocument();
    expect(screen.queryByText('defense')).not.toBeInTheDocument();
    expect(screen.getByText('The accused is at fault.')).toBeInTheDocument();
  });
});
