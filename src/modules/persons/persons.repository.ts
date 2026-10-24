import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  PersonIdentityDto,
  UpdatePersonDto,
  UpdatePersonNoteDto,
} from './dto/person.dto';

export type PersonRow = Record<string, unknown> & {
  person_id: string;
  site_id: string;
  last_name: string;
  first_name: string;
  phone_number?: string | null;
  email?: string | null;
  birth_date?: string | null;
  language_preference: string;
  is_active: boolean;
  created_at: Date | string;
  active_note_count?: number;
};

export type PersonNoteRow = Record<string, unknown> & {
  note_id: string;
  person_id: string;
  content: string;
  created_by_user_id: string;
  author_username?: string;
  created_at: Date | string;
  updated_at?: Date | string;
  is_active: boolean;
  deleted_at?: Date | string | null;
};

export interface PersonListQuery {
  siteId: string;
  isActive?: boolean;
  search?: string;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

export interface PersonNoteListQuery {
  personId: string;
  isActive: boolean;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

const PERSON_COLUMNS = [
  'person_id',
  'site_id',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'birth_date',
  'language_preference',
  'is_active',
  'deleted_at',
  'created_by_user_id',
  'updated_by_user_id',
  'created_at',
  'updated_at',
] as const;
const personColumns = (alias?: string) =>
  PERSON_COLUMNS.map((column) => (alias ? `${alias}.${column}` : column)).join(
    ', ',
  );
const NOTE_COLUMNS = `note_id, person_id, content, is_active, deleted_at,
  created_by_user_id, updated_by_user_id, created_at, updated_at`;

@Injectable()
export class PersonsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private database(manager?: EntityManager): DataSource | EntityManager {
    return manager ?? this.dataSource;
  }

  async existsInSites(personId: string, siteIds: string[]): Promise<boolean> {
    const rows: Array<{ person_id: string }> = await this.dataSource.query(
      `SELECT person_id FROM dorify.dori_person
       WHERE person_id = $1 AND site_id = ANY($2)
       LIMIT 1`,
      [personId, siteIds],
    );
    return rows.length > 0;
  }

  async findPersons(
    query: PersonListQuery,
  ): Promise<{ items: PersonRow[]; total: number }> {
    const params: unknown[] = [query.siteId];
    let where = `p.site_id = $1`;
    if (query.isActive !== undefined) {
      params.push(query.isActive);
      where += ` AND p.is_active = $${params.length}`;
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const searchParameter = `$${params.length}`;
      where += ` AND (p.first_name ILIKE ${searchParameter} OR p.last_name ILIKE ${searchParameter} OR p.email ILIKE ${searchParameter} OR p.phone_number ILIKE ${searchParameter})`;
    }
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(DISTINCT p.person_id)::int AS total FROM dorify.dori_person p WHERE ${where}`,
      params,
    );
    const items: PersonRow[] = await this.dataSource.query(
      `SELECT DISTINCT ${personColumns('p')},
       (SELECT COUNT(*)::int FROM dorify.dori_person_note pn
        WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
       FROM dorify.dori_person p WHERE ${where}
       ORDER BY p.${query.sortField} ${query.sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async findById(personId: string): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.dataSource.query(
      `SELECT ${personColumns('p')},
       (SELECT COUNT(*)::int FROM dorify.dori_person_note pn
        WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
       FROM dorify.dori_person p
       WHERE p.person_id = $1
       LIMIT 1`,
      [personId],
    );
    return rows[0] ?? null;
  }

  async findByPhone(
    siteId: string,
    phoneNumber: string,
    manager?: EntityManager,
  ): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.database(manager).query(
      `SELECT ${personColumns('p')},
       (SELECT COUNT(*)::int FROM dorify.dori_person_note pn
        WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
       FROM dorify.dori_person p
       WHERE p.site_id = $1 AND p.phone_number = $2
         AND p.is_active = TRUE AND p.deleted_at IS NULL
       LIMIT 1`,
      [siteId, phoneNumber],
    );
    return rows[0] ?? null;
  }

  async findByEmail(
    siteId: string,
    email: string,
    manager?: EntityManager,
  ): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.database(manager).query(
      `SELECT ${personColumns('p')},
       (SELECT COUNT(*)::int FROM dorify.dori_person_note pn
        WHERE pn.person_id = p.person_id AND pn.is_active = TRUE AND pn.deleted_at IS NULL) AS active_note_count
       FROM dorify.dori_person p
       WHERE p.site_id = $1 AND LOWER(p.email) = LOWER($2)
         AND p.is_active = TRUE AND p.deleted_at IS NULL
       LIMIT 1`,
      [siteId, email],
    );
    return rows[0] ?? null;
  }

  async create(
    dto: PersonIdentityDto,
    siteId: string,
    userId: string,
    now: Date,
    manager?: EntityManager,
  ): Promise<PersonRow> {
    const rows: PersonRow[] = await this.database(manager).query(
      `INSERT INTO dorify.dori_person (
        site_id, first_name, last_name, email, phone_number, birth_date, language_preference,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'fr'), $8, $8, $9, $9)
      RETURNING ${personColumns()}`,
      [
        siteId,
        dto.firstName ?? null,
        dto.lastName ?? null,
        dto.email ?? null,
        dto.phoneNumber ?? null,
        dto.birthDate ?? null,
        dto.languagePreference ?? null,
        userId,
        now,
      ],
    );
    return rows[0];
  }

  async update(
    personId: string,
    dto: UpdatePersonDto,
    userId: string,
    now: Date,
  ): Promise<PersonRow> {
    const columns: Array<[string, unknown]> = [
      ['first_name', dto.firstName],
      ['last_name', dto.lastName],
      ['email', dto.email],
      ['phone_number', dto.phoneNumber],
      ['birth_date', dto.birthDate],
      ['language_preference', dto.languagePreference],
      ['is_active', dto.isActive],
      [
        'deleted_at',
        dto.isActive === undefined ? undefined : dto.isActive ? null : now,
      ],
    ];
    const values: unknown[] = [];
    const assignments = columns
      .filter(([, value]) => value !== undefined)
      .map(([column, value]) => {
        values.push(value);
        return `${column} = $${values.length}`;
      });
    values.push(userId);
    assignments.push(`updated_by_user_id = $${values.length}`);
    values.push(now);
    assignments.push(`updated_at = $${values.length}`);
    values.push(personId);
    const rows: PersonRow[] = await this.dataSource.query(
      `UPDATE dorify.dori_person SET ${assignments.join(', ')} WHERE person_id = $${values.length} RETURNING ${personColumns()}`,
      values,
    );
    return rows[0];
  }

  async findNotes(
    query: PersonNoteListQuery,
  ): Promise<{ items: PersonNoteRow[]; total: number }> {
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dorify.dori_person_note
       WHERE person_id = $1 AND is_active = $2`,
      [query.personId, query.isActive],
    );
    const items: PersonNoteRow[] = await this.dataSource.query(
      `SELECT n.note_id, n.person_id, n.content, n.is_active, n.deleted_at, n.created_by_user_id,
              u.username AS author_username, n.created_at, n.updated_at
       FROM dorify.dori_person_note n
       JOIN dorify.dori_user u ON u.user_id = n.created_by_user_id
       WHERE n.person_id = $1 AND n.is_active = $2
       ORDER BY n.${query.sortField} ${query.sortOrder} LIMIT $3 OFFSET $4`,
      [query.personId, query.isActive, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async createNote(
    personId: string,
    content: string,
    userId: string,
    now: Date,
  ): Promise<PersonNoteRow> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `INSERT INTO dorify.dori_person_note (person_id, content, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $3, $4, $4)
       RETURNING note_id, person_id, content, created_by_user_id, created_at, updated_at`,
      [personId, content, userId, now],
    );
    return rows[0];
  }

  async updateNote(
    personId: string,
    noteId: string,
    dto: UpdatePersonNoteDto,
    userId: string,
    now: Date,
  ): Promise<PersonNoteRow | null> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `UPDATE dorify.dori_person_note SET content = COALESCE($1, content),
       is_active = COALESCE($2, is_active),
       deleted_at = CASE WHEN $2::boolean IS TRUE THEN NULL WHEN $2::boolean IS FALSE THEN $3 ELSE deleted_at END,
       updated_by_user_id = $4, updated_at = $3
       WHERE note_id = $5 AND person_id = $6 RETURNING ${NOTE_COLUMNS}`,
      [
        dto.content ?? null,
        dto.isActive ?? null,
        now,
        userId,
        noteId,
        personId,
      ],
    );
    return rows[0] ?? null;
  }

  async deleteNote(
    personId: string,
    noteId: string,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `UPDATE dorify.dori_person_note
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE note_id = $3 AND person_id = $4 AND is_active = TRUE RETURNING note_id, person_id`,
      [now, userId, noteId, personId],
    );
    return rows.length > 0;
  }

  async softDeleteWithNotes(
    personId: string,
    userId: string,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dorify.dori_person SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
         WHERE person_id = $3`,
        [now, userId, personId],
      );
      await manager.query(
        `UPDATE dorify.dori_person_note SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
         WHERE person_id = $3 AND is_active = TRUE`,
        [now, userId, personId],
      );
    });
  }
}
