import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  CreatePersonNoteDto,
  UpdatePersonNoteDto,
} from './dto/person.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import { PersonResponseDto, PersonNoteResponseDto } from './dto/person-response.dto';

@ApiTags('Personnes & Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  @RequirePermission('customer_view')
  @ApiOperation({ summary: 'Recherche paginée de personnes dans le périmètre accessible' })
  @ApiQuery({ name: 'search', required: false, description: 'Recherche par nom, prénom, email, téléphone' })
  @ApiStandardResponse({
    type: PersonResponseDto,
    isPaginated: true,
    description: 'Liste paginée des personnes enregistrées',
  })
  async findAll(
    @CurrentUser() user: UserContext,
    @Query() pagination: PaginationQueryDto,
    @Query('search') search?: string,
  ) {
    return this.personsService.findAll(user, pagination, search);
  }

  @Post()
  @RequirePermission('customer_register')
  @ApiOperation({ summary: 'Créer une identité personne' })
  @ApiStandardResponse({
    type: PersonResponseDto,
    status: HttpStatus.CREATED,
    description: 'Fiche personne créée avec succès',
  })
  async create(@Body() dto: CreatePersonDto) {
    return this.personsService.create(dto);
  }

  @Get(':personId')
  @RequirePermission('customer_view')
  @ApiOperation({ summary: "Consulter la fiche d'une personne" })
  @ApiStandardResponse({
    type: PersonResponseDto,
    description: 'Détails de la fiche personne',
  })
  async findById(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
  ) {
    return this.personsService.findById(user, personId);
  }

  @Patch(':personId')
  @RequirePermission('customer_edit')
  @ApiOperation({ summary: "Mettre à jour les informations d'une personne" })
  @ApiStandardResponse({
    type: PersonResponseDto,
    description: 'Fiche personne mise à jour',
  })
  async update(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.personsService.update(user, personId, dto);
  }

  // ---------------------------------------------------------------------------
  // Notes (§5.6, §4.16 - interdit au rôle kiosk)
  // ---------------------------------------------------------------------------
  @Get(':personId/notes')
  @RequirePermission('person_note_view')
  @ApiOperation({ summary: "Consulter les notes d'une personne (réservé hôtesse et +)" })
  @ApiStandardResponse({
    type: PersonNoteResponseDto,
    isArray: true,
    description: 'Historique des notes internes attachées à la personne',
  })
  async findNotes(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
  ) {
    return this.personsService.findNotes(user, personId);
  }

  @Post(':personId/notes')
  @RequirePermission('person_note_manage')
  @ApiOperation({ summary: 'Ajouter une note sur une personne' })
  @ApiStandardResponse({
    type: PersonNoteResponseDto,
    status: HttpStatus.CREATED,
    description: 'Note interne enregistrée',
  })
  async createNote(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
    @Body() dto: CreatePersonNoteDto,
  ) {
    return this.personsService.createNote(user, personId, dto);
  }

  @Patch(':personId/notes/:noteId')
  @RequirePermission('person_note_manage')
  @ApiOperation({ summary: 'Modifier une note existante' })
  @ApiStandardResponse({
    type: PersonNoteResponseDto,
    description: 'Note interne modifiée',
  })
  async updateNote(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdatePersonNoteDto,
  ) {
    return this.personsService.updateNote(user, personId, noteId, dto);
  }

  @Delete(':personId/notes/:noteId')
  @RequirePermission('person_note_manage')
  @ApiOperation({ summary: 'Supprimer une note (soft delete)' })
  @ApiStandardResponse({
    type: PersonNoteResponseDto,
    description: 'Note interne désactivée',
  })
  async deleteNote(
    @CurrentUser() user: UserContext,
    @Param('personId', ParseIntPipe) personId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.personsService.deleteNote(user, personId, noteId);
  }
}
