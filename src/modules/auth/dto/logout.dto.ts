import { IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      "ID de l'utilisateur à déconnecter. " +
      "Si égal à l'ID du caller, déclenche un global logout (toutes ses sessions). " +
      "Si différent, le caller doit être manager, admin ou root et avoir les droits hiérarchiques.",
    example: 42,
  })
  @IsInt()
  @IsOptional()
  userId?: number;
}

