import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, configureClient } from './client';
import { API_BASE, server } from '../test/server';

describe('api client', () => {
  beforeEach(() => {
    // Reset to a known configuration; individual tests override as needed.
    configureClient(
      () => null,
      () => undefined,
    );
  });

  it('attaches an Authorization Bearer header when a token is set', async () => {
    let authHeader: string | null = 'unset';
    configureClient(
      () => 'jwt-123',
      () => undefined,
    );
    server.use(
      http.get(`${API_BASE}/ping`, ({ request }) => {
        authHeader = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await api<{ ok: boolean }>('/ping');

    expect(result).toEqual({ ok: true });
    expect(authHeader).toBe('Bearer jwt-123');
  });

  it('omits the Authorization header when no token is set', async () => {
    let authHeader: string | null = 'unset';
    configureClient(
      () => null,
      () => undefined,
    );
    server.use(
      http.get(`${API_BASE}/ping`, ({ request }) => {
        authHeader = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await api('/ping');

    expect(authHeader).toBeNull();
  });

  it('on 401 calls the unauthorized handler and throws ApiError(401)', async () => {
    const onUnauthorized = vi.fn();
    configureClient(() => 'jwt-123', onUnauthorized);
    server.use(
      http.get(`${API_BASE}/secure`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 401 }),
      ),
    );

    const err = await api('/secure').catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('surfaces a non-ok body.message as the ApiError message', async () => {
    const onUnauthorized = vi.fn();
    configureClient(() => null, onUnauthorized);
    server.use(
      http.post(`${API_BASE}/runs`, () =>
        HttpResponse.json(
          { message: 'Charge sheet is empty.' },
          { status: 400 },
        ),
      ),
    );

    const err = await api('/runs', { method: 'POST' }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Charge sheet is empty.');
    // Non-401 errors must NOT trigger the sign-out path.
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('surfaces the data-policy / free-model 404 message through', async () => {
    const onUnauthorized = vi.fn();
    configureClient(() => null, onUnauthorized);
    server.use(
      http.get(`${API_BASE}/models/free`, () =>
        HttpResponse.json(
          {
            message:
              'No free model available under the data-privacy policy (free models only).',
          },
          { status: 404 },
        ),
      ),
    );

    const err = await api('/models/free').catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/free model/i);
    expect(err.message).toMatch(/privacy/i);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('returns undefined for a 204 No Content response', async () => {
    configureClient(() => null, () => undefined);
    server.use(
      http.delete(`${API_BASE}/runs/x`, () => new HttpResponse(null, { status: 204 })),
    );

    const result = await api('/runs/x', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });
});
