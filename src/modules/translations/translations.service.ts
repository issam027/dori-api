import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import { CreateTranslationDto, UpdateTranslationDto } from './dto/translation.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Valide que les paramètres {param} dans le contenu correspondent exactement à expectedParams (§4.15)
   */
  private validateExpectedParams(content: string, expectedParams?: string[]): void {
    if (!expectedParams) return;

    const matches = content.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
    const extractedParams = matches.map((m) => m.replace(/[\{\}]/g, ''));

    const expectedSet = new Set(expectedParams);
    const extractedSet = new Set(extractedParams);

    // Vérifier les paramètres inattendus ou manquants
    for (const p of extractedSet) {
      if (!expectedSet.has(p)) {
        throw new AppException(ErrorCode.TRANSLATION_PARAM_MISMATCH, {
          unexpectedParam: p,
          expected: expectedParams,
        });
      }
    }

    for (const p of expectedSet) {
      if (!extractedSet.has(p)) {
        throw new AppException(ErrorCode.TRANSLATION_PARAM_MISMATCH, {
          missingParam: p,
          expected: expectedParams,
        });
      }
    }
  }

  /**
   * Incrémente la version d'une catégorie de traduction (§3.13, §7.8)
   */
  private async incrementVersion(category: string): Promise<number> {
    const record = await this.prisma.translationVersion.upsert({
      where: { category },
      update: {
        version: { increment: 1 },
        updatedAt: this.clockService.now(),
      },
      create: {
        category,
        version: 1,
      },
    });
    return record.version;
  }

  /**
   * Téléchargement du bundle complet IHM avec version (§6.7)
   */
  async getBundle(locale: string = 'fr', category: string = 'ihm') {
    const [versionRecord, translations] = await Promise.all([
      this.prisma.translationVersion.findUnique({ where: { category } }),
      this.prisma.translation.findMany({
        where: { category, locale, isActive: true },
        select: { translationKey: true, content: true },
      }),
    ]);

    const entries: Record<string, string> = {};
    translations.forEach((t) => {
      entries[t.translationKey] = t.content;
    });

    return {
      locale,
      category,
      version: versionRecord?.version || 1,
      entries,
    };
  }

  async findAll(pagination: PaginationQueryDto, category?: string, locale?: string, key?: string) {
    const whereClause: any = { isActive: true };
    if (category) whereClause.category = category;
    if (locale) whereClause.locale = locale;
    if (key) whereClause.translationKey = { contains: key };

    const [items, total] = await Promise.all([
      this.prisma.translation.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ category: 'asc' }, { translationKey: 'asc' }],
      }),
      this.prisma.translation.count({ where: whereClause }),
    ]);

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async create(dto: CreateTranslationDto) {
    this.validateExpectedParams(dto.content, dto.expectedParams);

    const translation = await this.prisma.translation.create({
      data: {
        translationKey: dto.translationKey,
        category: dto.category,
        locale: dto.locale,
        content: dto.content,
        expectedParams: dto.expectedParams || [],
      },
    });

    await this.incrementVersion(dto.category);
    return translation;
  }

  async update(translationId: number, dto: UpdateTranslationDto) {
    const existing = await this.prisma.translation.findUnique({ where: { translationId } });
    if (!existing) throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);

    const expected = dto.expectedParams ?? existing.expectedParams;
    const content = dto.content ?? existing.content;

    this.validateExpectedParams(content, expected);

    const updated = await this.prisma.translation.update({
      where: { translationId },
      data: {
        content: dto.content,
        expectedParams: dto.expectedParams,
      },
    });

    await this.incrementVersion(existing.category);
    return updated;
  }

  async delete(translationId: number) {
    const existing = await this.prisma.translation.findUnique({ where: { translationId } });
    if (!existing) return { success: true };

    await this.prisma.translation.update({
      where: { translationId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
      },
    });

    await this.incrementVersion(existing.category);
    return { success: true };
  }
}
