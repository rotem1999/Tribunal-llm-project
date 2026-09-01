/** Typed fetch client (SPEC §11): attaches the Bearer token, routes to Login on
 * 401, and carries a stable `ErrorCode` on every failure (SPEC §12.1) so the UI
 * can render user-safe copy instead of a raw message. */

import { ErrorCode, type ApiErrorBody } from '@tribunal/shared-types';

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

/**
 * A failed request. `code` is the stable category (SPEC §12.1); `message` is the
 * backend's user-safe string (kept only as a fallback — the UI renders copy keyed
 * by `code`). `status` is 0 for a client-side network failure (`NETWORK`).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode = ErrorCode.INTERNAL,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => undefined;

export function configureClient(
  tokenGetter: () => string | null,
  unauthorizedHandler: () => void,
): void {
  getToken = tokenGetter;
  onUnauthorized = unauthorizedHandler;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // The request never reached the API (server down, offline, CORS) — no
    // response to read, so classify it client-side as NETWORK (SPEC §12.1).
    throw new ApiError('Network request failed.', 0, ErrorCode.NETWORK);
  }

  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError('Session expired — please sign in again.', 401, ErrorCode.UNAUTHORIZED);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    throw new ApiError(
      body.message ?? res.statusText,
      res.status,
      body.code ?? ErrorCode.INTERNAL,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
