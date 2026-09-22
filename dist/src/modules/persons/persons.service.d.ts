import { PrismaService } from '../../core/database/prisma.service';
import { ScopeService, UserContext } from '../../core/rbac/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { CreatePersonDto, UpdatePersonDto, CreatePersonNoteDto, UpdatePersonNoteDto } from './dto/person.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
export declare class PersonsService {
    private readonly prisma;
    private readonly scopeService;
    private readonly clockService;
    constructor(prisma: PrismaService, scopeService: ScopeService, clockService: ClockService);
    private validatePersonInScope;
    findAll(user: UserContext, pagination: PaginationQueryDto, search?: string): Promise<import("../../core/pagination/pagination.dto").PaginatedResult<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        languagePreference: string;
        personId: number;
        firstName: string | null;
        lastName: string | null;
        phoneNumber: string | null;
        birthDate: Date | null;
    }>>;
    findById(user: UserContext, personId: number): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        languagePreference: string;
        personId: number;
        firstName: string | null;
        lastName: string | null;
        phoneNumber: string | null;
        birthDate: Date | null;
    }>;
    create(dto: CreatePersonDto): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        languagePreference: string;
        personId: number;
        firstName: string | null;
        lastName: string | null;
        phoneNumber: string | null;
        birthDate: Date | null;
    }>;
    update(user: UserContext, personId: number, dto: UpdatePersonDto): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        languagePreference: string;
        personId: number;
        firstName: string | null;
        lastName: string | null;
        phoneNumber: string | null;
        birthDate: Date | null;
    }>;
    findNotes(user: UserContext, personId: number): Promise<({
        createdByUser: {
            userId: number;
            username: string;
        };
        updatedByUser: {
            userId: number;
            username: string;
        } | null;
    } & {
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        createdByUserId: number;
        content: string;
        personId: number;
        noteId: number;
        updatedByUserId: number | null;
    })[]>;
    createNote(user: UserContext, personId: number, dto: CreatePersonNoteDto): Promise<{
        createdByUser: {
            userId: number;
            username: string;
        };
    } & {
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        createdByUserId: number;
        content: string;
        personId: number;
        noteId: number;
        updatedByUserId: number | null;
    }>;
    updateNote(user: UserContext, personId: number, noteId: number, dto: UpdatePersonNoteDto): Promise<{
        updatedByUser: {
            userId: number;
            username: string;
        } | null;
    } & {
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        createdByUserId: number;
        content: string;
        personId: number;
        noteId: number;
        updatedByUserId: number | null;
    }>;
    deleteNote(user: UserContext, personId: number, noteId: number): Promise<{
        isActive: boolean;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        createdByUserId: number;
        content: string;
        personId: number;
        noteId: number;
        updatedByUserId: number | null;
    }>;
}
