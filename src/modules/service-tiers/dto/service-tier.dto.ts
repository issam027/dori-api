import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierDto {
  @ApiProperty({ example: 'gold', description: 'Code unique du forfait' })
  @IsString()
  @IsNotEmpty()
  tierCode: string;

  @ApiProperty({ example: 'Or', description: 'Nom affiché du forfait' })
  @IsString()
  @IsNotEmpty()
  tierName: string;

  @ApiPropertyOptional({
    example: 'Notification de bienvenue + seuil + lien de suivi',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTierDto {
  @ApiPropertyOptional({ example: 'Or Premium' })
  @IsString()
  @IsOptional()
  tierName?: string;

  @ApiPropertyOptional({ example: 'Description mise à jour' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Activer / désactiver le forfait' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssociateQueueTierDto {
  @ApiProperty({ example: 2, description: 'ID du forfait à associer' })
  @IsInt()
  tierId: number;

  @ApiProperty({ example: 5.0, description: 'Tarif (≥ 0)', minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'TND', description: 'Code devise ISO 4217' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 1, description: "Ordre d'affichage" })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateQueueTierDto {
  @ApiPropertyOptional({ example: 7.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateNotificationRuleDto {
  @ApiProperty({
    enum: ['welcome', 'threshold', 'trakingLink'],
    description: 'Type de notification',
  })
  @IsIn(['welcome', 'threshold', 'trakingLink'])
  notificationType: 'welcome' | 'threshold' | 'trakingLink';

  @ApiProperty({ enum: ['sms', 'email'], description: "Canal d'envoi" })
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @ApiPropertyOptional({
    example: 3,
    description: 'Déclencher quand la position du client atteint ce seuil',
  })
  @IsInt()
  @IsOptional()
  thresholdPosition?: number;

  @ApiPropertyOptional({
    example: 10,
    description: "Déclencher X minutes avant l'appel estimé",
  })
  @IsInt()
  @IsOptional()
  thresholdMinutes?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Inclure le lien de suivi dans la notification',
  })
  @IsBoolean()
  @IsOptional()
  includeTrackingLink?: boolean;
}

export class UpdateNotificationRuleDto {
  @ApiPropertyOptional({ enum: ['welcome', 'threshold', 'trakingLink'] })
  @IsIn(['welcome', 'threshold', 'trakingLink'])
  @IsOptional()
  notificationType?: 'welcome' | 'threshold' | 'trakingLink';

  @ApiPropertyOptional({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  @IsOptional()
  channel?: 'sms' | 'email';

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @IsOptional()
  thresholdPosition?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsInt()
  @IsOptional()
  thresholdMinutes?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeTrackingLink?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
