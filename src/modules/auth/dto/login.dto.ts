import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'root@dori.local',
    description: "Nom d'utilisateur ou adresse email",
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
