import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CronExecutionResponseDto {
  @Expose()
  @ApiProperty({
    example: true,
    description: 'Indique que la tâche planifiée a été exécutée avec succès.',
  })
  accepted!: boolean;
}
