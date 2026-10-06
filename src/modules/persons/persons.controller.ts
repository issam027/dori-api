import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { PersonsService } from './persons.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  PersonFilterDto,
  CreateNoteDto,
  UpdateNoteDto,
} from './dto/person.dto';
import {
  PersonDetailDto,
  PaginatedPersonResponseDto,
  PersonNoteDetailDto,
  PaginatedPersonNoteResponseDto,
  PersonDeleteResponseDto,
} from './dto/person-response.dto';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Persons')
@ApiBearerAuth('bearer')
@ApiDoriErrorResponses()
@Controller('api/v1/persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  @RequirePermission('registration_view')
  @ApiOperation({
    summary: 'Lister les personnes / clients',
    description: 'Recherche paginée de personnes par nom, téléphone ou email.',
  })
  @ApiDoriOkResponse(PaginatedPersonResponseDto, 'Liste des personnes')
  async findPersons(
    @Query() filter: PersonFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.findPersons(filter, user);
  }

  @Post()
  @RequirePermission('registration_register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une fiche personne',
    description: 'Enregistre une nouvelle personne dans la base de données.',
  })
  @ApiDoriCreatedResponse(PersonDetailDto, 'Personne créée avec succès')
  async createPerson(
    @Body() dto: CreatePersonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.createPerson(dto, dto.siteId, user);
  }

  @Get(':personId')
  @RequirePermission('registration_view')
  @ApiOperation({
    summary: "Détails d'une personne",
    description:
      "Retourne la fiche complète d'une personne par son identifiant.",
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiDoriOkResponse(PersonDetailDto, 'Détails de la personne')
  async findOne(
    @Param('personId', ParseIntPipe) personId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.findPersonById(personId, user);
  }

  @Patch(':personId')
  @RequirePermission('registration_edit')
  @ApiOperation({
    summary: 'Modifier une fiche personne',
    description: "Met à jour les coordonnées ou informations d'une personne.",
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiDoriOkResponse(PersonDetailDto, 'Fiche modifiée')
  async updatePerson(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() dto: UpdatePersonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.updatePerson(personId, dto, user);
  }

  @Get(':personId/notes')
  @RequirePermission('person_note_view')
  @ApiOperation({
    summary: 'Lister les notes attachées à une personne',
    description:
      'Retourne la liste paginée des notes médicales ou administratives internes rattachées au profil.',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiDoriOkResponse(
    PaginatedPersonNoteResponseDto,
    'Liste paginée des notes de la personne',
  )
  async getNotes(
    @Param('personId', ParseIntPipe) personId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.findPersonNotes(personId, pagination, user);
  }

  @Post(':personId/notes')
  @RequirePermission('person_note_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ajouter une note sur une personne',
    description:
      'Ajoute une observation ou consigne interne visible par les opérateurs.',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiDoriCreatedResponse(PersonNoteDetailDto, 'Note ajoutée')
  async createNote(
    @Param('personId', ParseIntPipe) personId: number,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.createNote(personId, dto, user);
  }

  @Patch(':personId/notes/:noteId')
  @RequirePermission('person_note_manage')
  @ApiOperation({
    summary: 'Modifier une note',
    description: "Met à jour le contenu d'une note existante.",
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiParam({ name: 'noteId', type: Number, description: 'ID de la note' })
  @ApiDoriOkResponse(PersonNoteDetailDto, 'Note mise à jour')
  async updateNote(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.updateNote(personId, noteId, dto, user);
  }

  @Delete(':personId/notes/:noteId')
  @RequirePermission('person_note_manage')
  @ApiOperation({
    summary: 'Supprimer une note',
    description: 'Supprime logiquement une note.',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiParam({ name: 'noteId', type: Number, description: 'ID de la note' })
  @ApiDoriOkResponse(PersonDeleteResponseDto, 'Note supprimée')
  async deleteNote(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.deleteNote(personId, noteId, user);
  }

  @Delete(':personId')
  @RequirePermission('registration_delete')
  @ApiOperation({
    summary: 'Supprimer une personne',
    description: 'Supprime logiquement une personne et ses notes associées.',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la personne',
  })
  @ApiDoriOkResponse(PersonDeleteResponseDto, 'Personne supprimée avec succès')
  async deletePerson(
    @Param('personId', ParseIntPipe) personId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.personsService.deletePerson(personId, user);
  }
}
