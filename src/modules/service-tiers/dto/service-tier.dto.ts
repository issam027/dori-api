import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO4217CurrencyCode,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierDto {
  @ApiProperty({ example: 'gold', description: 'Code unique du forfait' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tierCode: string;

  @ApiProperty({ example: 'Or', description: 'Nom affiché du forfait' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tierName: string;

  @ApiPropertyOptional({
    example: 'Notification de bienvenue + seuil + lien de suivi',
  })
  @IsString()
  @MaxLength(500)
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

  @ApiPropertyOptional({
    example: 'EUR',
    nullable: true,
    description:
      'Surcharge ISO 4217 de cette association ; null ou absence = devise effective de la file',
  })
  @IsISO4217CurrencyCode()
  @IsOptional()
  currency?: string | null;

  @ApiPropertyOptional({ example: 1, description: "Ordre d'affichage" })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Définir ce forfait comme choix par défaut de la file',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateQueueTierDto {
  @ApiPropertyOptional({ example: 7.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    example: 'EUR',
    nullable: true,
    description:
      'Surcharge ISO 4217 ; null rétablit l’héritage depuis la file puis le site',
  })
  @IsISO4217CurrencyCode()
  @IsOptional()
  currency?: string | null;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Définir ou retirer ce forfait comme choix par défaut',
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateNotificationRuleDto {
  @ApiProperty({
    enum: ['welcome', 'threshold'],
    description: 'Type de notification',
  })
  @IsIn(['welcome', 'threshold'])
  notificationType: 'welcome' | 'threshold';

  @ApiProperty({ enum: ['sms', 'email'], description: "Canal d'envoi" })
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @ApiPropertyOptional({
    enum: ['position', 'estimatedTime'],
    description: 'Nature du seuil ; requis uniquement pour le type threshold',
  })
  @IsIn(['position', 'estimatedTime'])
  @IsOptional()
  thresholdType?: 'position' | 'estimatedTime';

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    description: 'Position ou nombre de minutes selon thresholdType',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  thresholdValue?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Inclure le lien de suivi dans la notification',
  })
  @IsBoolean()
  @IsOptional()
  includeTrackingLink?: boolean;
}

export class UpdateNotificationRuleDto {
  @ApiPropertyOptional({ enum: ['welcome', 'threshold'] })
  @IsIn(['welcome', 'threshold'])
  @IsOptional()
  notificationType?: 'welcome' | 'threshold';

  @ApiPropertyOptional({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  @IsOptional()
  channel?: 'sms' | 'email';

  @ApiPropertyOptional({ enum: ['position', 'estimatedTime'], nullable: true })
  @IsIn(['position', 'estimatedTime'])
  @IsOptional()
  thresholdType?: 'position' | 'estimatedTime' | null;

  @ApiPropertyOptional({ example: 5, minimum: 1, nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  thresholdValue?: number | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeTrackingLink?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
