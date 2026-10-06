import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PersonIdentityDto, UpdatePersonDto } from './dto/person.dto';

export type PersonRow = Record<string, unknown> & {
  person_id: number;
  site_id: number;
};

export type PersonNoteRow = Record<string, unknown> & {
  note_id: number;
  person_id: number;
};

export interface PersonListQuery {
  siteId: number;
  search?: string;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

export interface PersonNoteListQuery {
  personId: number;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize: number;
  offset: number;
}

@Injectable()
export class PersonsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private database(manager?: EntityManager): DataSource | EntityManager {
    return manager ?? this.dataSource;
  }

  async existsInSites(personId: number, siteIds: number[]): Promise<boolean> {
    const rows: Array<{ person_id: number }> = await this.dataSource.query(
      `SELECT person_id FROM dori_person
       WHERE person_id = $1 AND site_id = ANY($2)
         AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [personId, siteIds],
    );
    return rows.length > 0;
  }

  async findPersons(
    query: PersonListQuery,
  ): Promise<{ items: PersonRow[]; total: number }> {
    const params: unknown[] = [query.siteId];
    let where = `p.site_id = $1 AND p.is_active = TRUE AND p.deleted_at IS NULL`;
    if (query.search) {
      params.push(`%${query.search}%`);
      where += ` AND (p.first_name ILIKE $2 OR p.last_name ILIKE $2 OR p.email ILIKE $2 OR p.phone_number ILIKE $2)`;
    }
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(DISTINCT p.person_id)::int AS total FROM dori_person p WHERE ${where}`,
      params,
    );
    const items: PersonRow[] = await this.dataSource.query(
      `SELECT DISTINCT p.* FROM dori_person p WHERE ${where}
       ORDER BY p.${query.sortField} ${query.sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async findActiveById(personId: number): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.dataSource.query(
      `SELECT * FROM dori_person
       WHERE person_id = $1 AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [personId],
    );
    return rows[0] ?? null;
  }

  async findByPhone(
    siteId: number,
    phoneNumber: string,
    manager?: EntityManager,
  ): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.database(manager).query(
      `SELECT * FROM dori_person
       WHERE site_id = $1 AND phone_number = $2
         AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [siteId, phoneNumber],
    );
    return rows[0] ?? null;
  }

  async findByEmail(
    siteId: number,
    email: string,
    manager?: EntityManager,
  ): Promise<PersonRow | null> {
    const rows: PersonRow[] = await this.database(manager).query(
      `SELECT * FROM dori_person
       WHERE site_id = $1 AND LOWER(email) = LOWER($2)
         AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [siteId, email],
    );
    return rows[0] ?? null;
  }

  async create(
    dto: PersonIdentityDto,
    siteId: number,
    userId: number,
    now: Date,
    manager?: EntityManager,
  ): Promise<PersonRow> {
    const rows: PersonRow[] = await this.database(manager).query(
      `INSERT INTO dori_person (
        site_id, first_name, last_name, email, phone_number, birth_date, language_preference,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'fr'), $8, $8, $9, $9)
      RETURNING *`,
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
    personId: number,
    dto: UpdatePersonDto,
    userId: number,
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
      `UPDATE dori_person SET ${assignments.join(', ')} WHERE person_id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0];
  }

  async findNotes(
    query: PersonNoteListQuery,
  ): Promise<{ items: PersonNoteRow[]; total: number }> {
    const countRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM dori_person_note
       WHERE person_id = $1 AND is_active = TRUE`,
      [query.personId],
    );
    const items: PersonNoteRow[] = await this.dataSource.query(
      `SELECT n.note_id, n.person_id, n.content, n.created_by_user_id,
              u.username AS author_username, n.created_at, n.updated_at
       FROM dori_person_note n
       JOIN dori_user u ON u.user_id = n.created_by_user_id
       WHERE n.person_id = $1 AND n.is_active = TRUE
       ORDER BY n.${query.sortField} ${query.sortOrder} LIMIT $2 OFFSET $3`,
      [query.personId, query.pageSize, query.offset],
    );
    return { items, total: countRows[0]?.total ?? 0 };
  }

  async createNote(
    personId: number,
    content: string,
    userId: number,
    now: Date,
  ): Promise<PersonNoteRow> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `INSERT INTO dori_person_note (person_id, content, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $3, $4, $4)
       RETURNING note_id, person_id, content, created_by_user_id, created_at, updated_at`,
      [personId, content, userId, now],
    );
    return rows[0];
  }

  async updateNote(
    personId: number,
    noteId: number,
    content: string,
    userId: number,
    now: Date,
  ): Promise<PersonNoteRow | null> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `UPDATE dori_person_note SET content = $1, updated_by_user_id = $2, updated_at = $3
       WHERE note_id = $4 AND person_id = $5 AND is_active = TRUE
       RETURNING note_id, person_id, content, created_by_user_id, created_at, updated_at`,
      [content, userId, now, noteId, personId],
    );
    return rows[0] ?? null;
  }

  async deleteNote(
    personId: number,
    noteId: number,
    userId: number,
    now: Date,
  ): Promise<boolean> {
    const rows: PersonNoteRow[] = await this.dataSource.query(
      `UPDATE dori_person_note
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE note_id = $3 AND person_id = $4 AND is_active = TRUE RETURNING note_id, person_id`,
      [now, userId, noteId, personId],
    );
    return rows.length > 0;
  }

  async softDeleteWithNotes(
    personId: number,
    userId: number,
    now: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE dori_person SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
         WHERE person_id = $3`,
        [now, userId, personId],
      );
      await manager.query(
        `UPDATE dori_person_note SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
         WHERE person_id = $3 AND is_active = TRUE`,
        [now, userId, personId],
      );
    });
  }
}
