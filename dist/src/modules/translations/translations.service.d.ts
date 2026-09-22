import { PrismaService } from '../../core/database/prisma.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreateTranslationDto, UpdateTranslationDto } from './dto/translation.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
export declare class TranslationsService {
    private readonly prisma;
    private readonly clockService;
    constructor(prisma: PrismaService, clockService: ClockService);
    private validateExpectedParams;
    private incrementVersion;
    getBundle(locale?: string, category?: string): Promise<{
        locale: string;
        category: string;
        version: number;
        entries: Record<string, string>;
    }>;
    findAll(pagination: PaginationQueryDto, category?: string, locale?: string, key?: string): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        translationKey: string;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        content: string;
        category: string;
        expectedParams: string[];
        translationId: number;
    }>>;
    create(dto: CreateTranslationDto): Promise<{
        translationKey: string;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        content: string;
        category: string;
        expectedParams: string[];
        translationId: number;
    }>;
    update(translationId: number, dto: UpdateTranslationDto): Promise<{
        translationKey: string;
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        locale: string;
        content: string;
        category: string;
        expectedParams: string[];
        translationId: number;
    }>;
    delete(translationId: number): Promise<{
        success: boolean;
    }>;
}
