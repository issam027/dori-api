import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreatePersonDto,
  UpdatePersonDto,
  PersonFilterDto,
  CreateNoteDto,
  UpdateNoteDto,
} from './dto/person.dto';
import { PaginationDto, PaginatedResult } from '../../core/pagination/pagination.dto';
import { PersonNoteDetailDto } from './dto/person-response.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class PersonsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  private async checkPersonScope(personId: number, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    if (scope.isGlobal) return;

    // Check if person has had at least one registration in user's scope queues (§4.11, §4.16)
    if (scope.queueIds.length === 0) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }

    const reg = await this.dataSource.query(
      `SELECT customer_id FROM dori_customer WHERE person_id = $1 AND queue_id = ANY($2) LIMIT 1`,
      [personId, scope.queueIds],
    );

    if (!reg || reg.length === 0) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }
  }

  async findPersons(filter: PersonFilterDto, user: AuthenticatedUser) {
    const scope = await this.scopeService.getUserScope(user);
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      ['person_id', 'first_name', 'last_name', 'email', 'phone_number', 'created_at', 'updated_at'],
      'person_id',
    );

    let query = `SELECT DISTINCT p.* FROM dori_person p`;
    const params: any[] = [];

    if (!scope.isGlobal) {
      if (scope.queueIds.length === 0) {
        return filter.createResponse([], 0);
      }
      query += ` JOIN dori_customer c ON c.person_id = p.person_id AND c.queue_id = ANY($1)`;
      params.push(scope.queueIds);
    }

    query += ` WHERE p.is_active = TRUE AND p.deleted_at IS NULL`;

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const pIdx = params.length;
      query += ` AND (p.first_name ILIKE $${pIdx} OR p.last_name ILIKE $${pIdx} OR p.email ILIKE $${pIdx} OR p.phone_number ILIKE $${pIdx})`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY p.${safeSortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async findPersonById(personId: number, user: AuthenticatedUser) {
    await this.checkPersonScope(personId, user);

    const rows = await this.dataSource.query(
      `SELECT * FROM dori_person WHERE person_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [personId],
    );

    if (!rows || rows.length === 0) {
      throw new DoriException('PERSON_NOT_FOUND', { personId });
    }

    return rows[0];
  }

  async createPerson(dto: CreatePersonDto, user: AuthenticatedUser) {
    const now = this.clockService.now();

    // Deduplication check (§3.4, §4.16)
    if (dto.phoneNumber) {
      const existingPhone = await this.dataSource.query(
        `SELECT * FROM dori_person WHERE phone_number = $1 AND is_active = TRUE LIMIT 1`,
        [dto.phoneNumber],
      );
      if (existingPhone && existingPhone.length > 0) {
        return existingPhone[0];
      }
    }

    if (dto.email) {
      const existingEmail = await this.dataSource.query(
        `SELECT * FROM dori_person WHERE LOWER(email) = LOWER($1) AND is_active = TRUE LIMIT 1`,
        [dto.email],
      );
      if (existingEmail && existingEmail.length > 0) {
        return existingEmail[0];
      }
    }

    const res = await this.dataSource.query(
      `INSERT INTO dori_person (
        first_name, last_name, email, phone_number, birth_date, language_preference,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'fr'), $7, $7, $8, $8)
      RETURNING *`,
      [
        dto.firstName || null,
        dto.lastName || null,
        dto.email || null,
        dto.phoneNumber || null,
        dto.birthDate || null,
        dto.languagePreference || null,
        user.userId,
        now,
      ],
    );

    return res[0];
  }

  async updatePerson(
    personId: number,
    dto: UpdatePersonDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    await this.findPersonById(personId, user);

    const now = this.clockService.now();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const mapField = (dbCol: string, val: any) => {
      if (val !== undefined) {
        fields.push(`${dbCol} = $${idx++}`);
        values.push(val);
      }
    };

    mapField('first_name', dto.firstName);
    mapField('last_name', dto.lastName);
    mapField('email', dto.email);
    mapField('phone_number', dto.phoneNumber);
    mapField('birth_date', dto.birthDate);
    mapField('language_preference', dto.languagePreference);
    mapField('is_active', dto.isActive);

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(personId);

    const res = await this.dataSource.query(
      `UPDATE dori_person SET ${fields.join(', ')} WHERE person_id = $${idx} RETURNING *`,
      values,
    );

    return res[0];
  }

  // Notes (§3.5, §4.16, §5.6)
  async findPersonNotes(
    personId: number,
    pagination: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<PersonNoteDetailDto>> {
    await this.checkPersonScope(personId, user);
    const { pageSize, offset, sortOrder } = pagination.getParams();
    const sortField = pagination.getSafeSortField(
      ['note_id', 'created_at', 'updated_at'],
      'created_at',
    );

    const query = `
      SELECT n.*, u.username as author_username
      FROM dori_person_note n
      JOIN dori_user u ON u.user_id = n.created_by_user_id
      WHERE n.person_id = $1 AND n.is_active = TRUE
    `;

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      [personId],
    );
    const total = countRes[0]?.total || 0;

    const items = await this.dataSource.query(
      `${query} ORDER BY n.${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      [personId],
    );

    const formattedItems = items.map((n: any) => ({
      noteId: n.note_id,
      personId: n.person_id,
      content: n.content,
      createdByUserId: n.created_by_user_id,
      authorUsername: n.author_username,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    return pagination.createResponse<PersonNoteDetailDto>(formattedItems, total);
  }

  async createPersonNote(
    personId: number,
    dto: CreateNoteDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `INSERT INTO dori_person_note (person_id, content, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $3, $4, $4)
       RETURNING *`,
      [personId, dto.content, user.userId, now],
    );

    return res[0];
  }

  async updatePersonNote(
    personId: number,
    noteId: number,
    dto: UpdateNoteDto,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `UPDATE dori_person_note
       SET content = $1, updated_by_user_id = $2, updated_at = $3
       WHERE note_id = $4 AND person_id = $5 AND is_active = TRUE
       RETURNING *`,
      [dto.content, user.userId, now, noteId, personId],
    );

    if (!res || res.length === 0) {
      throw new DoriException('NOTE_NOT_FOUND', { noteId });
    }

    return res[0];
  }

  async deletePersonNote(
    personId: number,
    noteId: number,
    user: AuthenticatedUser,
  ) {
    await this.checkPersonScope(personId, user);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `UPDATE dori_person_note
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE note_id = $3 AND person_id = $4 AND is_active = TRUE
       RETURNING *`,
      [now, user.userId, noteId, personId],
    );

    if (!res || res.length === 0) {
      throw new DoriException('NOTE_NOT_FOUND', { noteId });
    }

    return { noteId, deleted: true };
  }

  async getNotes(
    personId: number,
    paginationOrUser?: PaginationDto | AuthenticatedUser,
    maybeUser?: AuthenticatedUser,
  ): Promise<PaginatedResult<PersonNoteDetailDto>> {
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
    dto: CreateNoteDto,
    user: AuthenticatedUser,
  ) {
    const n = await this.createPersonNote(personId, dto, user);
    return {
      noteId: n.note_id,
      personId: n.person_id,
      content: n.content,
      createdByUserId: n.created_by_user_id,
      createdAt: n.created_at,
    };
  }

  async updateNote(
    personId: number,
    noteId: number,
    dto: UpdateNoteDto,
    user: AuthenticatedUser,
  ) {
    const n = await this.updatePersonNote(personId, noteId, dto, user);
    return {
      noteId: n.note_id,
      personId: n.person_id,
      content: n.content,
      createdByUserId: n.created_by_user_id,
      createdAt: n.created_at,
    };
  }

  async deleteNote(personId: number, noteId: number, user: AuthenticatedUser) {
    const res = await this.deletePersonNote(personId, noteId, user);
    return { id: res.noteId, deleted: res.deleted };
  }

  async deletePerson(personId: number, user: AuthenticatedUser) {
    await this.checkPersonScope(personId, user);
    await this.findPersonById(personId, user);

    const now = this.clockService.now();

    // 1. Soft delete de la personne
    await this.dataSource.query(
      `UPDATE dori_person
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE person_id = $3`,
      [now, user.userId, personId],
    );

    // 2. Cascade de désactivation sur ses notes
    await this.dataSource.query(
      `UPDATE dori_person_note
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE person_id = $3 AND is_active = TRUE`,
      [now, user.userId, personId],
    );

    return { id: personId, deleted: true };
  }
}
