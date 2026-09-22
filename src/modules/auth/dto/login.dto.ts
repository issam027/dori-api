import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'root' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'RootAdmin2026!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token opaque' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  newPassword!: string;
}
