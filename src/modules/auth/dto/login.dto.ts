import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'root',
    description: "Nom d'utilisateur",
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'Root@123456',
    description: 'Mot de passe',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
