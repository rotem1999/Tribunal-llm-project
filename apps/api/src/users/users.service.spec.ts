import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { User } from './user.entity';
import { UsersService } from './users.service';

/**
 * User lookup, password hashing, and the boot seed (SPEC §7). The argon2id
 * hash/verify round-trip is exercised for real (deterministic, no DB); the
 * repository and config are mocked.
 */

function makeRepo() {
  return {
    findOne: jest.fn<(opts: unknown) => Promise<User | null>>(),
    count: jest.fn<() => Promise<number>>(),
    create: jest.fn<(x: Partial<User>) => Partial<User>>((x) => x),
    save: jest.fn<(x: Partial<User>) => Promise<Partial<User>>>(async (x) => ({
      id: 'new-id',
      ...x,
    })),
  };
}
type UserRepoMock = ReturnType<typeof makeRepo>;

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const v = values[key];
      if (v === undefined) throw new Error(`Missing config ${key}`);
      return v;
    },
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

function makeService(repo: UserRepoMock, config = makeConfig()) {
  return new UsersService(
    repo as unknown as Repository<User>,
    config,
  );
}

describe('UsersService password hashing (argon2id)', () => {
  let service: UsersService;
  beforeEach(() => {
    service = makeService(makeRepo());
  });

  it('hashPassword returns an argon2id hash, never the plaintext', async () => {
    const hash = await service.hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await service.hashPassword('samePassword');
    const b = await service.hashPassword('samePassword');
    expect(a).not.toBe(b);
  });

  it('verifyPassword returns true for the matching password (round-trip)', async () => {
    const hash = await service.hashPassword('s3cret-pass');
    await expect(service.verifyPassword(hash, 's3cret-pass')).resolves.toBe(true);
  });

  it('verifyPassword returns false for a wrong password', async () => {
    const hash = await service.hashPassword('s3cret-pass');
    await expect(service.verifyPassword(hash, 'wrong-pass')).resolves.toBe(false);
  });
});

describe('UsersService lookups', () => {
  it('findByUsername delegates to the repository with a username filter', async () => {
    const repo = makeRepo();
    const user = { id: 'u1', username: 'alice' } as User;
    repo.findOne.mockResolvedValue(user);
    const service = makeService(repo);
    await expect(service.findByUsername('alice')).resolves.toBe(user);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { username: 'alice' } });
  });

  it('findById delegates to the repository with an id filter', async () => {
    const repo = makeRepo();
    repo.findOne.mockResolvedValue(null);
    const service = makeService(repo);
    await expect(service.findById('u9')).resolves.toBeNull();
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'u9' } });
  });
});

describe('UsersService.onModuleInit seed (SPEC §7)', () => {
  it('seeds one user from SEED_* config when the table is empty', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(0);
    const config = makeConfig({
      SEED_USERNAME: 'owner',
      SEED_PASSWORD: 'owner-pass',
    });
    const service = makeService(repo, config);

    await service.onModuleInit();

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const created = repo.create.mock.calls[0][0] as {
      username: string;
      passwordHash: string;
    };
    expect(created.username).toBe('owner');
    // The stored hash must be argon2id and never the plaintext.
    expect(created.passwordHash).not.toBe('owner-pass');
    expect(created.passwordHash.startsWith('$argon2id$')).toBe(true);
    // And it must actually verify.
    await expect(
      service.verifyPassword(created.passwordHash, 'owner-pass'),
    ).resolves.toBe(true);
  });

  it('does NOT seed (idempotent) when a user already exists', async () => {
    const repo = makeRepo();
    repo.count.mockResolvedValue(1);
    const service = makeService(
      repo,
      makeConfig({ SEED_USERNAME: 'owner', SEED_PASSWORD: 'x' }),
    );
    await service.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
