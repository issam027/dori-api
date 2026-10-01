import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: "Nom d'utilisateur",
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: '••••••••••••',
    description: 'Mot de passe',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
