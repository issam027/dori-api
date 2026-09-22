import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfigFieldDto<T = any> {
  @ApiProperty({ example: 15, description: 'Valeur effective du paramètre' })
  value!: T;

  @ApiProperty({ example: 'inherited', enum: ['inherited', 'overridden'], description: 'Origine de la valeur (§4.5)' })
  source!: 'inherited' | 'overridden';
}

export class QueueResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiProperty({ example: 1 })
  siteId!: number;

  @ApiPropertyOptional({ example: 'Médecine Générale', nullable: true })
  queueName?: string | null;

  @ApiProperty({ example: 10 })
  averageWaitTime!: number;

  @ApiProperty({ example: 3 })
  threadCount!: number;

  @ApiProperty({ type: ConfigFieldDto })
  appointmentsEnabled!: ConfigFieldDto<boolean>;

  @ApiProperty({ type: ConfigFieldDto })
  appointmentSlotDuration!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  slotCapacity!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  workingHoursStart!: ConfigFieldDto<string>;

  @ApiProperty({ type: ConfigFieldDto })
  workingHoursEnd!: ConfigFieldDto<string>;

  @ApiProperty({ type: ConfigFieldDto })
  breakStart!: ConfigFieldDto<string | null>;

  @ApiProperty({ type: ConfigFieldDto })
  breakEnd!: ConfigFieldDto<string | null>;

  @ApiProperty({ type: ConfigFieldDto })
  lateToleranceMinutes!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  baseWeightWalkin!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  baseWeightAppointment!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  escalationRateWalkin!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  escalationRateAppointment!: ConfigFieldDto<number>;

  @ApiProperty({ type: ConfigFieldDto })
  carryOverWaiting!: ConfigFieldDto<boolean>;

  @ApiProperty({ type: ConfigFieldDto })
  dailyResetMode!: ConfigFieldDto<string>;

  @ApiProperty({ type: ConfigFieldDto })
  dailyResetTime!: ConfigFieldDto<string>;
}

export class NextAppointmentDto {
  @ApiProperty({ example: 101 })
  customerId!: number;

  @ApiProperty({ example: 'MED-012' })
  ticketNumber!: string;

  @ApiPropertyOptional({ example: '2026-09-20T10:30:00.000Z', nullable: true })
  scheduledTime?: Date | null;

  @ApiPropertyOptional({ example: 'booked', nullable: true })
  appointmentStatus?: string | null;

  @ApiProperty({ example: 'waiting' })
  status!: string;
}

export class QueueStatusResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 'MED-01' })
  queueCode!: string;

  @ApiProperty({ example: 5, description: "Nombre de clients en attente aujourd'hui" })
  waitingCount!: number;

  @ApiProperty({ example: 2, description: 'Nombre de guichets actuellement connectés' })
  activeThreadsCount!: number;

  @ApiProperty({ example: 3, description: 'Nombre total de guichets configurés' })
  totalThreads!: number;

  @ApiProperty({ example: 25, description: "Temps d'attente estimé en minutes" })
  estimatedWaitMinutes!: number;

  @ApiProperty({ type: [NextAppointmentDto], description: 'Prochains rendez-vous planifiés' })
  nextAppointments!: NextAppointmentDto[];
}

export class QueueThreadSessionDto {
  @ApiProperty({ example: 12 })
  sessionId!: number;

  @ApiProperty({ example: 5 })
  userId!: number;

  @ApiProperty({ example: 'agent1' })
  username!: string;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  connectedAt!: string;

  @ApiProperty({ example: '2026-09-20T09:30:00.000Z' })
  lastSeenAt!: string;

  @ApiProperty({ example: 2, description: 'Minutes depuis la dernière activité' })
  inactiveMinutes!: number;

  @ApiPropertyOptional({ example: 42, nullable: true, description: 'ID de l’inscription en cours de traitement' })
  currentRegistrationId?: number | null;
}

export class QueueThreadDto {
  @ApiProperty({ example: 1, description: 'Numéro physique du guichet' })
  threadNumber!: number;

  @ApiProperty({ example: 'occupied', enum: ['free', 'occupied'] })
  status!: string;

  @ApiPropertyOptional({ type: QueueThreadSessionDto, nullable: true })
  session!: QueueThreadSessionDto | null;
}

export class QueueThreadsResponseDto {
  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: 3 })
  threadCount!: number;

  @ApiProperty({ type: [QueueThreadDto] })
  threads!: QueueThreadDto[];
}

export class QueueOperatorDto {
  @ApiProperty({ example: 5 })
  userId!: number;

  @ApiProperty({ example: 'agent1' })
  username!: string;

  @ApiPropertyOptional({ example: 'agent1@dori.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'human', enum: ['human', 'kiosk'] })
  userType!: string;
}

export class QueueOperatorAssignmentResponseDto {
  @ApiProperty({ example: 5 })
  userId!: number;

  @ApiProperty({ example: 1 })
  queueId!: number;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  assignedAt!: Date;
}
