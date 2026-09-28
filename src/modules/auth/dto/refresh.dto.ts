import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optionnel si transmis via cookie HttpOnly)',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
