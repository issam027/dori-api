import { ApiProperty } from '@nestjs/swagger';

export class QueueDailyMetricsDto {
  @ApiProperty({ example: 45, description: "Nombre total d'inscriptions sur la journée" })
  totalRegistrations!: number;

  @ApiProperty({ example: 40, description: 'Nombre de clients servis avec succès' })
  servedCount!: number;

  @ApiProperty({ example: 3, description: 'Nombre de clients déclarés absents (no-show)' })
  noShowCount!: number;

  @ApiProperty({ example: 2, description: 'Nombre de clients encore en attente' })
  waitingCount!: number;

  @ApiProperty({ example: 0, description: 'Nombre de clients ou RDV expirés' })
  expiredCount!: number;

  @ApiProperty({ example: 7, description: "Taux d'absence / no-show en pourcentage" })
  noShowRatePercent!: number;

  @ApiProperty({ example: 12, description: "Temps moyen d'attente effectif en minutes" })
  averageWaitTimeActualMinutes!: number;
}

export class QueueDailyReportResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiProperty({ example: '2026-09-20' })
  businessDate!: string;

  @ApiProperty({ type: QueueDailyMetricsDto })
  metrics!: QueueDailyMetricsDto;
}
