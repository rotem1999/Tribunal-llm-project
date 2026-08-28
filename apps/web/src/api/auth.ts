import type { AuthUser, LoginResponse } from '@tribunal/shared-types';
import { api } from './client';

export function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchMe(): Promise<AuthUser> {
  return api<AuthUser>('/auth/me');
}
