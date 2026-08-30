import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Login } from './Login';
import { API_BASE, server } from '../test/server';
import { LocationProbe, renderWithProviders } from '../test/utils';

const TOKEN_KEY = 'tribunal.token';

describe('Login', () => {
  it('validates that both fields are filled before calling the API', async () => {
    const { user } = renderWithProviders(<Login />, { route: '/login' });

    // No handler is registered; if a request fired, MSW would error the test.
    await user.click(screen.getByRole('button', { name: /Sign in/ }));

    expect(
      screen.getByText('Enter the seeded username and password.'),
    ).toBeInTheDocument();
  });

  it('maps a 401 to an invalid-credentials message', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json({ message: 'bad creds' }, { status: 401 }),
      ),
    );

    const { user } = renderWithProviders(<Login />, { route: '/login' });

    await user.type(screen.getByLabelText('Username'), 'judge');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /Sign in/ }));

    expect(
      await screen.findByText('Invalid username or password.'),
    ).toBeInTheDocument();
    // Token must not have been stored on a failed login.
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('stores the token and navigates to "/" on a successful sign-in', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json({ accessToken: 'good-token' }),
      ),
      // AuthProvider loads the current user once a token is held.
      http.get(`${API_BASE}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', username: 'judge' }),
      ),
    );

    const { user } = renderWithProviders(
      <>
        <Login />
        <LocationProbe />
      </>,
      { route: '/login' },
    );

    await user.type(screen.getByLabelText('Username'), 'judge');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(screen.getByRole('button', { name: /Sign in/ }));

    await waitFor(() => {
      // Exact match — '/login' also contains '/', so assert the whole path.
      expect(screen.getByTestId('location-pathname').textContent).toBe('/');
    });
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('good-token');
  });
});
