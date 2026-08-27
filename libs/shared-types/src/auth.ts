/** Auth contract (SPEC §7, §10). */

/** `POST /auth/login` request body. */
export interface LoginRequest {
  username: string;
  password: string;
}

/** `POST /auth/login` response. */
export interface LoginResponse {
  accessToken: string;
}

/** `GET /auth/me` response — the current authenticated user. */
export interface AuthUser {
  id: string;
  username: string;
}
