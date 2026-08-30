import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import type { LoginRequest } from '@tribunal/shared-types';

/** `POST /auth/login` body — implements the shared LoginRequest contract. */
export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 's3cr3t', format: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
