import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';

const TOKEN_KEY = 'tribunal.token';

/** Seed (or clear) the stored JWT the way AuthContext reads it. */
export function seedToken(token: string | null): void {
  if (token === null) sessionStorage.removeItem(TOKEN_KEY);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

/** Surfaces the current router pathname so navigation is assertable. */
export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location-pathname">{loc.pathname}</div>;
}

function Providers({
  children,
  initialEntries,
}: {
  children: ReactNode;
  initialEntries: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    token = null,
  }: { route?: string; token?: string | null } = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  seedToken(token);
  const user = userEvent.setup();
  const result = render(
    <Providers initialEntries={[route]}>{ui}</Providers>,
  );
  return { ...result, user };
}
