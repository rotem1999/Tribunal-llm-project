import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TribunalCircle } from './TribunalCircle';
import { makePersonas } from '../test/fixtures';

describe('TribunalCircle', () => {
  it('renders all seven personas by name and a finished counter', () => {
    const personas = makePersonas();
    render(
      <TribunalCircle
        personas={personas}
        done={new Set(['support_1', 'support_2'])}
        phase="advocates"
      />,
    );

    for (const p of personas) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
    // 2 of 7 finished.
    expect(screen.getByText('2 / 7 finished')).toBeInTheDocument();
    expect(screen.getByText(/Advocates are speaking/i)).toBeInTheDocument();
  });
});
