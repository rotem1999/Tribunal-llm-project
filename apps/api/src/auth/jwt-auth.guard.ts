import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guards routes with the JWT strategy (SPEC §7). Rejects missing/invalid/expired tokens with 401. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
