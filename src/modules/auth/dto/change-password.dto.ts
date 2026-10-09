import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel', example: '••••••••••••' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (entre 10 et 20 caractères)',
    example: '••••••••••••',
    minLength: 10,
    maxLength: 20,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  newPassword: string;
}
