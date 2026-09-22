import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TranslationsService } from './translations.service';
import { CreateTranslationDto, UpdateTranslationDto } from './dto/translation.dto';
import { PaginationQueryDto } from '../../core/pagination/pagination.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/permissions.decorator';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  TranslationBundleResponseDto,
  TranslationResponseDto,
} from './dto/translation-response.dto';

@ApiTags('Traductions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get('bundle')
  @ApiOperation({ summary: 'Télécharger le bundle complet de traduction IHM avec version (§6.7)' })
  @ApiQuery({ name: 'locale', required: false, example: 'fr' })
  @ApiQuery({ name: 'category', required: false, example: 'ihm' })
  @ApiStandardResponse({
    type: TranslationBundleResponseDto,
    description: 'Dictionnaire clé/valeur pour l’IHM avec numéro de version du cache (§6.7)',
  })
  async getBundle(
    @Query('locale') locale?: string,
    @Query('category') category?: string,
  ) {
    return this.translationsService.getBundle(locale || 'fr', category || 'ihm');
  }

  @Get()
  @RequirePermission('translation_manage')
  @ApiOperation({ summary: 'Liste paginée des clés de traduction' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'key', required: false })
  @ApiStandardResponse({
    type: TranslationResponseDto,
    isPaginated: true,
    description: 'Liste paginée des libellés et textes du système',
  })
  async findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('category') category?: string,
    @Query('locale') locale?: string,
    @Query('key') key?: string,
  ) {
    return this.translationsService.findAll(pagination, category, locale, key);
  }

  @Post()
  @RequirePermission('translation_manage')
  @ApiOperation({ summary: 'Créer une traduction avec validation des paramètres attendus' })
  @ApiStandardResponse({
    type: TranslationResponseDto,
    status: HttpStatus.CREATED,
    description: 'Traduction créée avec incrémentation de la version du bundle',
  })
  async create(@Body() dto: CreateTranslationDto) {
    return this.translationsService.create(dto);
  }

  @Patch(':translationId')
  @RequirePermission('translation_manage')
  @ApiOperation({ summary: 'Mettre à jour une traduction' })
  @ApiStandardResponse({
    type: TranslationResponseDto,
    description: 'Traduction modifiée avec incrémentation de version',
  })
  async update(
    @Param('translationId', ParseIntPipe) translationId: number,
    @Body() dto: UpdateTranslationDto,
  ) {
    return this.translationsService.update(translationId, dto);
  }

  @Delete(':translationId')
  @RequirePermission('translation_manage')
  @ApiOperation({ summary: 'Désactiver une traduction (soft delete)' })
  @ApiStandardResponse({
    type: TranslationResponseDto,
    description: 'Traduction désactivée',
  })
  async delete(@Param('translationId', ParseIntPipe) translationId: number) {
    return this.translationsService.delete(translationId);
  }
}
