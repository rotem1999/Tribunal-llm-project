import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Field, Input } from './ui';

describe('ui primitives', () => {
  it('Button is disabled and does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Run' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Button fires onClick when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Field associates its label with the control', () => {
    render(
      <Field label="Username" htmlFor="u">
        <Input id="u" />
      </Field>,
    );
    // The label text is present and the input is reachable.
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(document.getElementById('u')).toBeInstanceOf(HTMLInputElement);
  });
});
