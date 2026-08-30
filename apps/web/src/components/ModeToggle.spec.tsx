import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RunMode } from '@tribunal/shared-types';
import { ModeToggle } from './ModeToggle';

describe('ModeToggle', () => {
  it('renders both run-mode options', () => {
    render(<ModeToggle value={RunMode.A_single} onChange={() => undefined} />);
    expect(
      screen.getByRole('button', { name: /Single model/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Model per persona/ }),
    ).toBeInTheDocument();
  });

  it('marks the active option (Single model) as selected', () => {
    render(<ModeToggle value={RunMode.A_single} onChange={() => undefined} />);
    const single = screen.getByRole('button', { name: /Single model/ });
    const perPersona = screen.getByRole('button', {
      name: /Model per persona/,
    });
    expect(single.className).toContain('border-accent');
    expect(perPersona.className).not.toContain('border-accent');
  });

  it('marks Model-per-persona active when that is the value', () => {
    render(
      <ModeToggle value={RunMode.B_per_persona} onChange={() => undefined} />,
    );
    expect(
      screen.getByRole('button', { name: /Model per persona/ }).className,
    ).toContain('border-accent');
    expect(
      screen.getByRole('button', { name: /Single model/ }).className,
    ).not.toContain('border-accent');
  });

  it('calls onChange with the other mode when the inactive option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeToggle value={RunMode.A_single} onChange={onChange} />);

    await user.click(
      screen.getByRole('button', { name: /Model per persona/ }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(RunMode.B_per_persona);
  });

  it('calls onChange back to A_single from B_per_persona', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeToggle value={RunMode.B_per_persona} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Single model/ }));

    expect(onChange).toHaveBeenCalledWith(RunMode.A_single);
  });
});
