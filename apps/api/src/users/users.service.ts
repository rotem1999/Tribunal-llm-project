import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from '@node-rs/argon2';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/**
 * User lookup + password hashing, and the idempotent boot seed (SPEC §7).
 * On first boot with an empty table, seeds one user from SEED_USERNAME /
 * SEED_PASSWORD (argon2id). The plaintext password is never logged.
 */
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedInitialUser();
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** argon2id hash of a plaintext password. */
  hashPassword(plain: string): Promise<string> {
    return hash(plain);
  }

  /** Verify a plaintext password against a stored argon2id hash. */
  verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
    return verify(passwordHash, plain);
  }

  /** Create the single seed user if none exists. Safe to run on every boot. */
  private async seedInitialUser(): Promise<void> {
    if ((await this.users.count()) > 0) {
      this.logger.log('User seed skipped — a user already exists.');
      return;
    }
    const username = this.config.getOrThrow<string>('SEED_USERNAME');
    const password = this.config.getOrThrow<string>('SEED_PASSWORD');
    const passwordHash = await this.hashPassword(password);
    await this.users.save(this.users.create({ username, passwordHash }));
    this.logger.log(`Seeded initial user "${username}".`);
  }
}
