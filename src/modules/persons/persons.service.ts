import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  PersonIdentityDto,
  UpdatePersonDto,
  PersonFilterDto,
  CreatePersonNoteDto,
  UpdatePersonNoteDto,
} from './dto/person.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../core/pagination/pagination.dto';
import {
  PersonNoteResponseDto,
  PersonResponseDto,
} from './dto/person-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PersonsRepository } from './persons.repository';

@Injectable()
export class PersonsService {
  constructor(
    private readonly personsRepository: PersonsRepository,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  private async checkPersonScope(personId: number, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    if (scope.isGlobal) return;

    if (scope.siteIds.length === 0) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }

    if (
      !(await this.personsRepository.existsInSites(personId, scope.siteIds))
    ) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }
  }

  async findPersons(
    filter: PersonFilterDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<PersonResponseDto>> {
    await this.scopeService.checkSiteAccess(user, filter.siteId);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      [
        'person_id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'created_at',
        'updated_at',
      ],
      'person_id',
    );

    const result = await this.personsRepository.findPersons({
      siteId: filter.siteId,
      search: filter.search,
      sortField: safeSortField,
      sortOrder,
      pageSize,
      offset,
    });
    return filter.createResponse<PersonResponseDto>(
      result.items as unknown as PersonResponseDto[],
      result.total,
    );
  }

  async findPersonById(personId: number, user: AuthenticatedUser) {
    await this.checkPersonScope(personId, user);

    const person = await this.personsRepository.findActiveById(personId);
    if (!person) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }

    return person;
  }

  async createPerson(
    dto: PersonIdentityDto,
    siteId: number,
    user: AuthenticatedUser,
    manager?: EntityManager,
  ) {
    await this.scopeService.checkSiteAccess(user, siteId);
    const now = this.clockService.now();

    // A person is unique only inside one site.
    if (dto.phoneNumber) {
      const existingPhone = await this.personsRepository.findByPhone(
        siteId,
        dto.phoneNumber,
        manager,
      );
      if (existingPhone) {
        return existingPhone;
      }
    }

    if (dto.email) {
      const existingEmail = await this.personsRepository.findByEmail(
        siteId,
        dto.email,
        manager,
      );
      if (existingEmail) {
        return existingEmail;
      }
    }

    return this.personsRepository.create(
      dto,
      siteId,
      user.userId,
      now,
      manager,
    );
  }

  async updatePerson(
    personId: number,
    dto: UpdatePersonDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    await this.findPersonById(personId, user);

    const now = this.clockService.now();
    return this.personsRepository.update(personId, dto, user.userId, now);
  }

  // Notes (§3.5, §4.16, §5.6)
  async findPersonNotes(
    personId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<PersonNoteResponseDto>> {
    await this.checkPersonScope(personId, user);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['note_id', 'created_at', 'updated_at'],
      'created_at',
    );

    const result = await this.personsRepository.findNotes({
      personId,
      sortField,
      sortOrder,
      pageSize,
      offset,
    });
    return pagination.createResponse<PersonNoteResponseDto>(
      result.items as unknown as PersonNoteResponseDto[],
      result.total,
    );
  }

  async createPersonNote(
    personId: number,
    dto: CreatePersonNoteDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    return this.personsRepository.createNote(
      personId,
      dto.content,
      user.userId,
      now,
    );
  }

  async updatePersonNote(
    personId: number,
    noteId: number,
    dto: UpdatePersonNoteDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    const note = await this.personsRepository.updateNote(
      personId,
      noteId,
      dto.content,
      user.userId,
      now,
    );
    if (!note) {
      throw new DoriException('NOTE_NOT_FOUND', { noteId });
    }

    return note;
  }

  async deletePersonNote(
    personId: number,
    noteId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    const deleted = await this.personsRepository.deleteNote(
      personId,
      noteId,
      user.userId,
      now,
    );
    if (!deleted) {
      throw new DoriException('NOTE_NOT_FOUND', { noteId });
    }

    return { noteId, deleted: true };
  }

  async getNotes(
    personId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<PersonNoteResponseDto>> {
    let pagination: PaginationDto;
    let user: AuthenticatedUser;

    if (paginationOrUser && 'userId' in paginationOrUser) {
      user = paginationOrUser as AuthenticatedUser;
      pagination = new PaginationDto();
    } else {
      pagination = (paginationOrUser as PaginationDto) || new PaginationDto();
      user = maybeUser!;
    }

    return this.findPersonNotes(personId, pagination, user);
  }

  async createNote(
    personId: number,
    dto: CreatePersonNoteDto,
    user: AuthenticatedUser,
  ) {
    return this.createPersonNote(personId, dto, user);
  }

  async updateNote(
    personId: number,
    noteId: number,
    dto: UpdatePersonNoteDto,
    user: AuthenticatedUser,
  ) {
    return this.updatePersonNote(personId, noteId, dto, user);
  }

  async deleteNote(personId: number, noteId: number, user: AuthenticatedUser) {
    const res = await this.deletePersonNote(personId, noteId, user);
    return { id: res.noteId, deleted: res.deleted };
  }

  async deletePerson(personId: number, user: AuthenticatedUser) {
    await this.checkPersonScope(personId, user);
    await this.findPersonById(personId, user);

    const now = this.clockService.now();
    await this.personsRepository.softDeleteWithNotes(
      personId,
      user.userId,
      now,
    );
    return { id: personId, deleted: true };
  }
}
