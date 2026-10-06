import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ClockService } from '../../core/clock/clock.service';
import { DoriException } from '../../core/errors/dori.exception';
import { PaginatedResult } from '../../core/pagination/pagination.dto';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  TranslationBundleQueryDto,
  CreateTranslationDto,
  TranslationFilterDto,
  UpdateTranslationDto,
} from './dto/translation.dto';
import { TranslationResponseDto } from './dto/translation-response.dto';
import { TranslationsRepository } from './translations.repository';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly translationsRepository: TranslationsRepository,
    private readonly clockService: ClockService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async getBundle(query: TranslationBundleQueryDto) {
    const category = query.category || 'ihm';
    const { version, rows } = await this.translationsRepository.getBundle(
      category,
      query.locale,
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
    const { items, total } = await this.translationsRepository.findActive(
      filter,
      sortField,
    );
    return filter.createResponse(
      items as unknown as TranslationResponseDto[],
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
    this.emitInvalidation(result.category, result.version);
    return result.item;
  }

  async updateTranslation(
    translationId: number,
    dto: UpdateTranslationDto,
    user: AuthenticatedUser,
  ) {
    const result = await this.translationsRepository.update(
      translationId,
      dto,
      user.userId,
      this.clockService.now(),
      (content, expected) => this.validateParams(content, expected),
    );
    if (!result) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }
    this.emitInvalidation(result.category, result.version);
    return result.item;
  }

  async deleteTranslation(translationId: number, user: AuthenticatedUser) {
    const result = await this.translationsRepository.delete(
      translationId,
      user.userId,
      this.clockService.now(),
    );
    if (!result) {
      throw new DoriException('TRANSLATION_NOT_FOUND', { translationId });
    }
    this.emitInvalidation(result.category, result.version);
    return { translationId, deleted: true };
  }

  private emitInvalidation(category: string, version: number) {
    this.realtimeService.emitTranslationInvalidation(category, version);
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
