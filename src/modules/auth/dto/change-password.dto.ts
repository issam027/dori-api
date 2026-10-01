import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel', example: '••••••••••••' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (minimum 10 caractères)',
    example: 'NewSecure@2026',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  newPassword: string;
}
