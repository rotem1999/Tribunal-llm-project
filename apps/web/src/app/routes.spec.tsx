import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './routes';
import { API_BASE, server } from '../test/server';
import { LocationProbe, renderWithProviders } from '../test/utils';

describe('ProtectedRoute / AppRoutes', () => {
  it('redirects an unauthenticated visitor to /login', async () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <LocationProbe />
      </>,
      { route: '/new', token: null },
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe(
        '/login',
      );
    });
    // The login screen is what actually rendered.
    expect(
      screen.getByRole('button', { name: /Sign in/ }),
    ).toBeInTheDocument();
  });

  it('lets a token-holder through to a protected route', async () => {
    server.use(
      // AuthProvider fetches the current user once a token is held.
      http.get(`${API_BASE}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', username: 'judge' }),
      ),
      http.get(`${API_BASE}/runs`, () => HttpResponse.json([])),
    );

    renderWithProviders(
      <>
        <AppRoutes />
        <LocationProbe />
      </>,
      { route: '/history', token: 'valid-token' },
    );

    // Stayed on /history (not bounced to /login) and the page rendered.
    expect(await screen.findByText('Past runs')).toBeInTheDocument();
    expect(screen.getByTestId('location-pathname').textContent).toBe(
      '/history',
    );
  });

  it('redirects the index route to /new for an authenticated user', async () => {
    server.use(
      http.get(`${API_BASE}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', username: 'judge' }),
      ),
      http.get(`${API_BASE}/charge-sheet`, () =>
        HttpResponse.json({
          id: 'cs-1',
          title: 'People v. Accused',
          content: 'x',
          isActive: true,
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-25T10:00:00.000Z',
        }),
      ),
      http.get(`${API_BASE}/models`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/personas`, () => HttpResponse.json([])),
    );

    renderWithProviders(
      <>
        <AppRoutes />
        <LocationProbe />
      </>,
      { route: '/', token: 'valid-token' },
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-pathname').textContent).toBe('/new');
    });
  });
});
