import { ApiProperty } from '@nestjs/swagger';

export class HealthServicesStatusDto {
  @ApiProperty({ example: 'up', description: 'Statut de la connexion PostgreSQL' })
  database!: string;

  @ApiProperty({ example: 'up', description: "Statut du serveur d'API NestJS" })
  api!: string;

  @ApiProperty({
    example: 'up',
    enum: ['up', 'down', 'not_configured'],
    description: "Statut de disponibilité du frontend (portail DORI)",
  })
  frontend!: string;
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded'], description: 'État global du système' })
  status!: string;

  @ApiProperty({ example: '2026-09-20T10:00:00.000Z', description: 'Horodatage ISO de la vérification' })
  timestamp!: string;

  @ApiProperty({ type: HealthServicesStatusDto, description: 'Détail de santé des sous-systèmes' })
  services!: HealthServicesStatusDto;
}