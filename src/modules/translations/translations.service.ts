import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateTranslationDto,
  UpdateTranslationDto,
  TranslationFilterDto,
  BundleQueryDto,
} from './dto/translation.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clockService: ClockService,
  ) {}

  private extractParams(content: string): string[] {
    const matches = content.match(/\{([a-zA-Z0-9_]+)\}/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1, -1));
  }

  private validateParams(content: string, expectedParams?: string[]) {
    const foundParams = this.extractParams(content);
    if (!expectedParams || expectedParams.length === 0) {
      if (foundParams.length > 0) {
        throw new DoriException('TRANSLATION_PARAM_MISMATCH', {
          foundParams,
          expectedParams: [],
        });
      }
      return;
    }

    // Check if every found param is in expectedParams, and every expectedParam is in foundParams
    const expectedSet = new Set(expectedParams);
    const foundSet = new Set(foundParams);

    for (const p of foundParams) {
      if (!expectedSet.has(p)) {
        throw new DoriException('TRANSLATION_PARAM_MISMATCH', {
          foundParams,
          expectedParams,
        });
      }
    }

    for (const p of expectedParams) {
      if (!foundSet.has(p)) {
        throw new DoriException('TRANSLATION_PARAM_MISMATCH', {
          foundParams,
          expectedParams,
        });
      }
    }
  }

  private async incrementVersion(category: string) {
    const now = this.clockService.now();
    await this.dataSource.query(
      `INSERT INTO dori_translation_version (category, version, updated_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (category)
       DO UPDATE SET version = dori_translation_version.version + 1, updated_at = $2`,
      [category, now],
    );
  }

  async getBundle(query: BundleQueryDto) {
    const category = query.category || 'ihm';
    const locale = query.locale;

    // Get current version
    const versionRes = await this.dataSource.query(
      `SELECT version FROM dori_translation_version WHERE category = $1`,
      [category],
    );
    const version = versionRes[0]?.version || 1;

    // Get active translations for this locale & category
    const rows = await this.dataSource.query(
      `SELECT translation_key, content
       FROM dori_translation
       WHERE category = $1 AND locale = $2 AND is_active = TRUE`,
      [category, locale],
    );

    const entries: Record<string, string> = {};
    for (const r of rows) {
      entries[r.translation_key] = r.content;
    }

    return {
      locale,
      category,
      version,
      entries,
    };
  }

  async findTranslations(filter: TranslationFilterDto) {
    const { pageSize, offset, sortOrder } = filter.getParams();
    const safeSortField = filter.getSafeSortField(
      ['translation_id', 'category', 'locale', 'translation_key', 'created_at', 'updated_at'],
      'translation_id',
    );

    let query = `SELECT * FROM dori_translation WHERE is_active = TRUE`;
    const params: any[] = [];

    if (filter.category) {
      params.push(filter.category);
      query += ` AND category = $${params.length}`;
    }
    if (filter.locale) {
      params.push(filter.locale);
      query += ` AND locale = $${params.length}`;
    }
    if (filter.key) {
      params.push(`%${filter.key}%`);
      query += ` AND translation_key ILIKE $${params.length}`;
    }

    const countRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as total FROM (${query}) q`,
      params,
    );
    const total = countRes[0]?.total || 0;

    query += ` ORDER BY ${safeSortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
    const items = await this.dataSource.query(query, params);

    return filter.createResponse(items, total);
  }

  async createTranslation(dto: CreateTranslationDto, user: AuthenticatedUser) {
    this.validateParams(dto.content, dto.expectedParams);
    const now = this.clockService.now();

    const res = await this.dataSource.query(
      `INSERT INTO dori_translation (
        translation_key, category, locale, content, expected_params,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7)
      ON CONFLICT (translation_key, locale)
      DO UPDATE SET content = $4, expected_params = $5, is_active = TRUE, deleted_at = NULL,
                    updated_by_user_id = $6, updated_at = $7
      RETURNING *`,
      [
        dto.translationKey,
        dto.category,
        dto.locale,
        dto.content,
        dto.expectedParams || null,
        user.userId,
        now,
      ],
    );

    await this.incrementVersion(dto.category);
    return res[0];
  }

  async updateTranslation(
    translationId: number,
    dto: UpdateTranslationDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.dataSource.query(
      `SELECT * FROM dori_translation WHERE translation_id = $1 AND is_active = TRUE`,
      [translationId],
    );

    if (!existing || existing.length === 0) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }

    const item = existing[0];
    const newContent = dto.content !== undefined ? dto.content : item.content;
    const newExpected =
      dto.expectedParams !== undefined
        ? dto.expectedParams
        : item.expected_params;

    this.validateParams(newContent, newExpected);
    const now = this.clockService.now();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(dto.content);
    }
    if (dto.expectedParams !== undefined) {
      fields.push(`expected_params = $${idx++}`);
      values.push(dto.expectedParams);
    }
    if (dto.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    fields.push(`updated_by_user_id = $${idx++}`);
    values.push(user.userId);
    fields.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(translationId);

    const res = await this.dataSource.query(
      `UPDATE dori_translation SET ${fields.join(', ')} WHERE translation_id = $${idx} RETURNING *`,
      values,
    );

    await this.incrementVersion(item.category);
    return res[0];
  }

  async deleteTranslation(translationId: number, user: AuthenticatedUser) {
    const existing = await this.dataSource.query(
      `SELECT * FROM dori_translation WHERE translation_id = $1 AND is_active = TRUE`,
      [translationId],
    );

    if (!existing || existing.length === 0) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }

    const item = existing[0];
    const now = this.clockService.now();

    await this.dataSource.query(
      `UPDATE dori_translation
       SET is_active = FALSE, deleted_at = $1, updated_by_user_id = $2, updated_at = $1
       WHERE translation_id = $3`,
      [now, user.userId, translationId],
    );

    await this.incrementVersion(item.category);
    return { translationId, deleted: true };
  }
}
