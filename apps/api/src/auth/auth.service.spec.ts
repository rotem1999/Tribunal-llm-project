import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';

/**
 * Credential verification + JWT issuance (SPEC §7). JwtService and UsersService
 * are mocked — no real crypto delay, no DB. We assert on the 401 behavior and
 * the signed payload shape.
 */

function setup() {
  const users = {
    findByUsername: jest.fn<(username: string) => Promise<User | null>>(),
    verifyPassword: jest.fn<(hash: string, plain: string) => Promise<boolean>>(),
  };
  const jwt = {
    signAsync: jest.fn<(payload: unknown) => Promise<string>>(
      async () => 'signed.jwt.token',
    ),
  };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
  );
  return { service, users, jwt };
}

const USER = {
  id: 'user-uuid',
  username: 'alice',
  passwordHash: '$argon2id$stored-hash',
} as User;

describe('AuthService.validateUser', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('returns the auth user (id + username only) on a correct password', async () => {
    ctx.users.findByUsername.mockResolvedValue(USER);
    ctx.users.verifyPassword.mockResolvedValue(true);

    const result = await ctx.service.validateUser('alice', 'correct-pass');

    expect(result).toEqual({ id: 'user-uuid', username: 'alice' });
    // Never leaks the password hash.
    expect(result).not.toHaveProperty('passwordHash');
    expect(ctx.users.verifyPassword).toHaveBeenCalledWith(
      '$argon2id$stored-hash',
      'correct-pass',
    );
  });

  it('throws 401 when the user does not exist (and does not check a password)', async () => {
    ctx.users.findByUsername.mockResolvedValue(null);
    await expect(ctx.service.validateUser('ghost', 'whatever')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.users.verifyPassword).not.toHaveBeenCalled();
  });

  it('throws 401 when the password does not match', async () => {
    ctx.users.findByUsername.mockResolvedValue(USER);
    ctx.users.verifyPassword.mockResolvedValue(false);
    await expect(
      ctx.service.validateUser('alice', 'wrong-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses a generic message that does not reveal which field was wrong', async () => {
    ctx.users.findByUsername.mockResolvedValue(null);
    const err = await ctx.service.validateUser('a', 'b').catch((e) => e);
    expect((err as Error).message).toMatch(/invalid username or password/i);
  });
});

describe('AuthService.login', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('issues a signed JWT with sub=user id and username on valid credentials', async () => {
    ctx.users.findByUsername.mockResolvedValue(USER);
    ctx.users.verifyPassword.mockResolvedValue(true);

    const result = await ctx.service.login('alice', 'correct-pass');

    expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    expect(ctx.jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-uuid',
      username: 'alice',
    });
  });

  it('does not sign a token when credentials are invalid', async () => {
    ctx.users.findByUsername.mockResolvedValue(USER);
    ctx.users.verifyPassword.mockResolvedValue(false);
    await expect(ctx.service.login('alice', 'nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.jwt.signAsync).not.toHaveBeenCalled();
  });
});
