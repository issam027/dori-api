import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token à révoquer (optionnel si transmis via cookie HttpOnly ou si la session active du JWT porteur doit être révoquée)',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
