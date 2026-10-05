import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  CreateTranslationDto,
  TranslationFilterDto,
  UpdateTranslationDto,
} from './dto/translation.dto';

export interface TranslationRow {
  translation_id: number;
  translation_key: string;
  category: string;
  locale: string;
  content: string;
  expected_params: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface VersionedResult<T> {
  item: T;
  category: string;
  version: number;
}

@Injectable()
export class TranslationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getBundle(category: string, locale: string) {
    const [versions, rows] = await Promise.all([
      this.dataSource.query<Array<{ version: number }>>(
        'SELECT version FROM dori_translation_version WHERE category = $1',
        [category],
      ),
      this.dataSource.query<
        Array<{ translation_key: string; content: string }>
      >(
        `SELECT translation_key, content FROM dori_translation
         WHERE category = $1 AND locale = $2 AND is_active = TRUE`,
        [category, locale],
      ),
    ]);
    return { version: versions[0]?.version ?? 1, rows };
  }

  async findActive(filter: TranslationFilterDto, sortField: string) {
    const { pageSize, offset, sortOrder } = filter.getParams();
    let where = 'WHERE is_active = TRUE';
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where += ` AND ${clause.replace('?', `$${params.length}`)}`;
    };
    if (filter.category) add('category = ?', filter.category);
    if (filter.locale) add('locale = ?', filter.locale);
    if (filter.key) add('translation_key ILIKE ?', `%${filter.key}%`);
    const [count] = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM dori_translation ${where}`,
      params,
    );
    const items = await this.dataSource.query<TranslationRow[]>(
      `SELECT * FROM dori_translation ${where}
       ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`,
      params,
    );
    return { items, total: count?.total ?? 0 };
  }

  create(dto: CreateTranslationDto, userId: number, now: Date) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<TranslationRow[]>(
        `INSERT INTO dori_translation (translation_key, category, locale, content,
         expected_params, created_by_user_id, updated_by_user_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$7)
         ON CONFLICT (translation_key, locale) DO UPDATE SET content=$4,
         expected_params=$5, is_active=TRUE, deleted_at=NULL,
         updated_by_user_id=$6, updated_at=$7 RETURNING *`,
        [
          dto.translationKey,
          dto.category,
          dto.locale,
          dto.content,
          dto.expectedParams || null,
          userId,
          now,
        ],
      );
      return {
        item: rows[0],
        category: dto.category,
        version: await this.incrementVersion(manager, dto.category, now),
      };
    });
  }

  update(
    translationId: number,
    dto: UpdateTranslationDto,
    userId: number,
    now: Date,
    validate: (content: string, expected: string[] | undefined) => void,
  ): Promise<VersionedResult<TranslationRow> | null> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query<TranslationRow[]>(
        `SELECT * FROM dori_translation
         WHERE translation_id=$1 AND is_active=TRUE FOR UPDATE`,
        [translationId],
      );
      const current = existing[0];
      if (!current) return null;
      validate(
        dto.content ?? current.content,
        dto.expectedParams ?? current.expected_params ?? undefined,
      );
      const fields: string[] = [];
      const values: unknown[] = [];
      const add = (column: string, value: unknown) => {
        if (value !== undefined) {
          values.push(value);
          fields.push(`${column}=$${values.length}`);
        }
      };
      add('content', dto.content);
      add('expected_params', dto.expectedParams);
      add('is_active', dto.isActive);
      add('updated_by_user_id', userId);
      add('updated_at', now);
      values.push(translationId);
      const rows = await manager.query<TranslationRow[]>(
        `UPDATE dori_translation SET ${fields.join(', ')}
         WHERE translation_id=$${values.length} RETURNING *`,
        values,
      );
      return {
        item: rows[0],
        category: current.category,
        version: await this.incrementVersion(manager, current.category, now),
      };
    });
  }

  delete(translationId: number, userId: number, now: Date) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query<TranslationRow[]>(
        `SELECT * FROM dori_translation
         WHERE translation_id=$1 AND is_active=TRUE FOR UPDATE`,
        [translationId],
      );
      if (!existing[0]) return null;
      await manager.query(
        `UPDATE dori_translation SET is_active=FALSE, deleted_at=$1,
         updated_by_user_id=$2, updated_at=$1 WHERE translation_id=$3`,
        [now, userId, translationId],
      );
      return {
        category: existing[0].category,
        version: await this.incrementVersion(
          manager,
          existing[0].category,
          now,
        ),
      };
    });
  }

  private async incrementVersion(
    manager: EntityManager,
    category: string,
    now: Date,
  ) {
    const rows = await manager.query<Array<{ version: number }>>(
      `INSERT INTO dori_translation_version (category, version, updated_at)
       VALUES ($1,1,$2) ON CONFLICT (category) DO UPDATE SET
       version=dori_translation_version.version+1, updated_at=$2 RETURNING version`,
      [category, now],
    );
    return Number(rows[0].version);
  }
}
