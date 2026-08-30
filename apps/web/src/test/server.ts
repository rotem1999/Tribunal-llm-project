import { setupServer } from 'msw/node';

/** Shared MSW server. Tests register per-case handlers with server.use(...).
 * The API base is client.ts's default (VITE_API_URL is unset in tests). */
export const API_BASE = 'http://localhost:3000/api';

export const server = setupServer();
