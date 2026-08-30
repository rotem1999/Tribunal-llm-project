import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser, LoginResponse } from '@tribunal/shared-types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface RequestWithUser {
  user: AuthUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with username/password; returns a JWT.' })
  @ApiResponse({ status: 200, description: 'Authenticated — returns accessToken.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current authenticated user.' })
  @ApiResponse({ status: 200, description: 'The current user.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  me(@Req() req: RequestWithUser): AuthUser {
    return req.user;
  }
}
