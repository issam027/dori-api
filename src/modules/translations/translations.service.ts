import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginatedResult } from '../../core/pagination/pagination.dto';
import {
  TranslationBundleQueryDto,
  CreateTranslationDto,
  TranslationFilterDto,
  UpdateTranslationDto,
} from './dto/translation.dto';
import { TranslationResponseDto } from './dto/translation-response.dto';
import {
  TranslationRow,
  TranslationsRepository,
} from './translations.repository';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly translationsRepository: TranslationsRepository,
    private readonly clockService: ClockService,
  ) {}

  private toResponseDto(row: TranslationRow): TranslationResponseDto {
    const iso = (value: Date) => value.toISOString();
    return {
      translationId: row.translation_id,
      translationKey: row.translation_key,
      category: row.category,
      locale: row.locale,
      content: row.content,
      expectedParams: row.expected_params ?? undefined,
      isActive: row.is_active,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  async getBundle(query: TranslationBundleQueryDto) {
    const category = query.category || 'ihm';
    const { version, rows } = await this.translationsRepository.getBundle(
      category,
      query.locale,
      query.isActive ?? true,
    );
    return {
      locale: query.locale,
      category,
      version,
      entries: Object.fromEntries(
        rows.map((row) => [row.translation_key, row.content]),
      ),
    };
  }

  async findTranslations(
    filter: TranslationFilterDto,
  ): Promise<PaginatedResult<TranslationResponseDto>> {
    const sortField = filter.getSafeSortField(
      [
        'translation_id',
        'category',
        'locale',
        'translation_key',
        'created_at',
        'updated_at',
      ],
      'translation_id',
    );
    const { items, total } = await this.translationsRepository.findPage(
      filter,
      sortField,
    );
    return filter.createResponse(
      items.map((item) => this.toResponseDto(item)),
      total,
    );
  }

  async createTranslation(dto: CreateTranslationDto, user: AuthenticatedUser) {
    this.validateParams(dto.content, dto.expectedParams);
    const result = await this.translationsRepository.create(
      dto,
      user.userId,
      this.clockService.now(),
    );
    return result.item;
  }

  async updateTranslation(
    translationId: string,
    dto: UpdateTranslationDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.translationsRepository.findById(translationId);
    if (!existing) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }
    const contentToValidate = dto.content ?? existing.content;
    const paramsToValidate =
      dto.expectedParams !== undefined
        ? dto.expectedParams
        : (existing.expected_params ?? undefined);
    this.validateParams(contentToValidate, paramsToValidate);

    const result = await this.translationsRepository.update(
      translationId,
      dto,
      user.userId,
      this.clockService.now(),
    );
    if (!result) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }
    return result.item;
  }

  async deleteTranslation(translationId: string, user: AuthenticatedUser) {
    const result = await this.translationsRepository.delete(
      translationId,
      user.userId,
      this.clockService.now(),
    );
    if (!result) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }
    return { translationId, deleted: true };
  }

  private validateParams(content: string, expectedParams?: string[]) {
    const foundParams = (content.match(/\{([a-zA-Z0-9_]+)\}/g) || []).map(
      (match) => match.slice(1, -1),
    );
    const expected = expectedParams || [];
    const foundSet = new Set(foundParams);
    const expectedSet = new Set(expected);
    if (
      foundParams.some((param) => !expectedSet.has(param)) ||
      expected.some((param) => !foundSet.has(param))
    ) {
      throw new DoriException('TRANSLATION_PARAM_MISMATCH', {
        foundParams,
        expectedParams: expected,
      });
    }
  }
}
