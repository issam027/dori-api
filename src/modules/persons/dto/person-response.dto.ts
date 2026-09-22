import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonResponseDto {
  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Mohamed' })
  firstName!: string;

  @ApiProperty({ example: 'Trabelsi' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'mohamed.trabelsi@email.tn', nullable: true })
  email?: string | null;

  @ApiProperty({ example: '+21698123456' })
  phoneNumber!: string;

  @ApiPropertyOptional({ example: '1985-05-12T00:00:00.000Z', nullable: true })
  birthDate?: Date | null;

  @ApiProperty({ example: 'fr' })
  languagePreference!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  updatedAt!: Date;
}

export class NoteAuthorDto {
  @ApiProperty({ example: 5 })
  userId!: number;

  @ApiProperty({ example: 'agent1' })
  username!: string;
}

export class PersonNoteResponseDto {
  @ApiProperty({ example: 1 })
  noteId!: number;

  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Client prioritaire à mobilité réduite.' })
  content!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: NoteAuthorDto })
  createdByUser!: NoteAuthorDto;

  @ApiPropertyOptional({ type: NoteAuthorDto, nullable: true })
  updatedByUser?: NoteAuthorDto | null;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  updatedAt!: Date;
}
