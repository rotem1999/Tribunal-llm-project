/** Typed fetch client (SPEC §11): attaches the Bearer token, surfaces the
 * data-policy error, and routes to Login on 401. */

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError('Session expired — please sign in again.', 401);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(body.message ?? res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
