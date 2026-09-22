import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AppException } from '../../core/errors/app.exception';
import { ErrorCode } from '../../core/errors/error-codes.enum';
import {
  CreatePersonDto,
  UpdatePersonDto,
  CreatePersonNoteDto,
  UpdatePersonNoteDto,
} from './dto/person.dto';
import { PaginationQueryDto, buildPaginatedResult } from '../../core/pagination/pagination.dto';

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly clockService: ClockService,
  ) {}

  /**
   * Vérifie si la personne est accessible dans le périmètre de l'utilisateur (§4.16)
   */
  private async validatePersonInScope(user: UserContext, personId: number): Promise<void> {
    if (this.scopeService.isSystemUser(user)) return;

    const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);
    if (!allowedQueueIds || allowedQueueIds.length === 0) {
      throw new AppException(ErrorCode.PERSON_NOT_FOUND, { personId });
    }

    // La personne doit avoir au moins une inscription dans les files autorisées
    const reg = await this.prisma.customer.findFirst({
      where: {
        personId,
        queueId: { in: allowedQueueIds },
      },
    });

    if (!reg) {
      throw new AppException(ErrorCode.PERSON_NOT_FOUND, { personId });
    }
  }

  async findAll(user: UserContext, pagination: PaginationQueryDto, search?: string) {
    const allowedQueueIds = await this.scopeService.getAllowedQueueIds(user);

    const whereClause: any = { isActive: true };

    if (allowedQueueIds !== null) {
      whereClause.customers = {
        some: {
          queueId: { in: allowedQueueIds },
        },
      };
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where: whereClause,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.person.count({ where: whereClause }),
    ]);

    return buildPaginatedResult(items, total, pagination.page, pagination.pageSize);
  }

  async findById(user: UserContext, personId: number) {
    await this.validatePersonInScope(user, personId);

    const person = await this.prisma.person.findFirst({
      where: { personId, isActive: true },
    });

    if (!person) throw new AppException(ErrorCode.PERSON_NOT_FOUND, { personId });
    return person;
  }

  async create(dto: CreatePersonDto) {
    return this.prisma.person.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        languagePreference: dto.languagePreference || 'fr',
      },
    });
  }

  async update(user: UserContext, personId: number, dto: UpdatePersonDto) {
    await this.validatePersonInScope(user, personId);

    return this.prisma.person.update({
      where: { personId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        languagePreference: dto.languagePreference,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Notes sur personne (§3.5, §4.16)
  // ---------------------------------------------------------------------------
  async findNotes(user: UserContext, personId: number) {
    await this.validatePersonInScope(user, personId);

    return this.prisma.personNote.findMany({
      where: { personId, isActive: true },
      include: {
        createdByUser: { select: { userId: true, username: true } },
        updatedByUser: { select: { userId: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(user: UserContext, personId: number, dto: CreatePersonNoteDto) {
    await this.validatePersonInScope(user, personId);

    return this.prisma.personNote.create({
      data: {
        personId,
        content: dto.content,
        createdByUserId: user.userId,
      },
      include: {
        createdByUser: { select: { userId: true, username: true } },
      },
    });
  }

  async updateNote(user: UserContext, personId: number, noteId: number, dto: UpdatePersonNoteDto) {
    await this.validatePersonInScope(user, personId);

    return this.prisma.personNote.update({
      where: { noteId },
      data: {
        content: dto.content,
        updatedByUserId: user.userId,
      },
      include: {
        updatedByUser: { select: { userId: true, username: true } },
      },
    });
  }

  async deleteNote(user: UserContext, personId: number, noteId: number) {
    await this.validatePersonInScope(user, personId);

    return this.prisma.personNote.update({
      where: { noteId },
      data: {
        isActive: false,
        deletedAt: this.clockService.now(),
        updatedByUserId: user.userId,
      },
    });
  }
}
