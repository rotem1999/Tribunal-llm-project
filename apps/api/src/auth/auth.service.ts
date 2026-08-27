import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, LoginResponse } from '@tribunal/shared-types';
import { UsersService } from '../users/users.service';

/** JWT payload (SPEC §7): subject = user id, plus username. */
export interface JwtPayload {
  sub: string;
  username: string;
}

/** Credential verification + JWT issuance (SPEC §7). */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** Return the user if the password matches, else 401. */
  async validateUser(username: string, password: string): Promise<AuthUser> {
    const user = await this.users.findByUsername(username);
    if (
      !user ||
      !(await this.users.verifyPassword(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return { id: user.id, username: user.username };
  }

  /** Verify credentials and issue a signed JWT. */
  async login(username: string, password: string): Promise<LoginResponse> {
    const user = await this.validateUser(username, password);
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
