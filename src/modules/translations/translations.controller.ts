import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriCreatedResponse,
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
  ApiDoriNotModifiedResponse,
} from '../../core/swagger/api-dori-response.decorator';
import { Response } from 'express';
import { TranslationsService } from './translations.service';
import {
  CreateTranslationDto,
  UpdateTranslationDto,
  TranslationFilterDto,
  TranslationBundleQueryDto,
} from './dto/translation.dto';
import {
  TranslationBundleResponseDto,
  PaginatedTranslationResponseDto,
  TranslationResponseDto,
  DeleteTranslationResponseDto,
} from './dto/translation-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Translations')
@ApiDoriErrorResponses()
@Controller('api/v1/translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Public()
  @Get('bundle')
  @ApiDoriPublicErrorResponses({
    omit404: true,
    omit409: true,
    omit422: true,
  })
  @ApiOperation({
    summary: 'Obtenir le bundle de traductions',
    description:
      'Retourne le dictionnaire de traductions pour une locale et une catégorie données avec support du cache HTTP via ETag.',
  })
  @ApiHeader({
    name: 'If-None-Match',
    required: false,
    description: 'ETag reçu lors du dernier téléchargement du bundle',
  })
  @ApiDoriNotModifiedResponse("Le bundle n'a pas changé; réponse sans corps.")
  @ApiDoriOkResponse(TranslationBundleResponseDto, 'Bundle de traductions', {
    ETag: {
      description: 'Version faible du bundle retourné',
      schema: { type: 'string' },
    },
  })
  async getBundle(
    @Query() query: TranslationBundleQueryDto,
    @Headers('if-none-match') ifNoneMatch: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = await this.translationsService.getBundle(query);
    const etag = `W/"${bundle.version}"`;

    if (ifNoneMatch === etag || ifNoneMatch === String(bundle.version)) {
      res.status(HttpStatus.NOT_MODIFIED);
      return;
    }

    res.setHeader('ETag', etag);
    return bundle;
  }

  @ApiBearerAuth('bearer')
  @Get()
  @RequirePermission('translation_manage')
  @ApiOperation({
    summary: 'Lister les traductions',
    description:
      'Retourne la liste paginée des traductions enregistrées selon les filtres spécifiés.',
  })
  @ApiDoriOkResponse(
    PaginatedTranslationResponseDto,
    'Liste paginée des traductions',
  )
  async findTranslations(@Query() filter: TranslationFilterDto) {
    return this.translationsService.findTranslations(filter);
  }

  @ApiBearerAuth('bearer')
  @Post()
  @RequirePermission('translation_manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer ou mettre à jour une traduction',
    description:
      'Enregistre une nouvelle traduction pour une clé et une locale données, avec validation des placeholders de gabarit.',
  })
  @ApiDoriCreatedResponse(
    TranslationResponseDto,
    'Traduction enregistrée avec succès',
  )
  async createTranslation(
    @Body() dto: CreateTranslationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.createTranslation(dto, user);
  }

  @ApiBearerAuth('bearer')
  @Patch(':translationId')
  @RequirePermission('translation_manage')
  @ApiOperation({
    summary: 'Mettre à jour une traduction',
    description:
      'Met à jour le contenu ou le statut actif d’une traduction existante.',
  })
  @ApiParam({
    name: 'translationId',
    type: Number,
    description: 'ID de la traduction',
  })
  @ApiDoriOkResponse(
    TranslationResponseDto,
    'Traduction mise à jour avec succès',
  )
  async updateTranslation(
    @Param('translationId', ParseIntPipe) translationId: number,
    @Body() dto: UpdateTranslationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.updateTranslation(translationId, dto, user);
  }

  @ApiBearerAuth('bearer')
  @Delete(':translationId')
  @RequirePermission('translation_manage')
  @ApiOperation({
    summary: 'Supprimer une traduction',
    description:
      'Désactive et supprime logiquement une traduction (soft-delete).',
  })
  @ApiParam({
    name: 'translationId',
    type: Number,
    description: 'ID de la traduction',
  })
  @ApiDoriOkResponse(
    DeleteTranslationResponseDto,
    'Traduction supprimée avec succès',
  )
  async deleteTranslation(
    @Param('translationId', ParseIntPipe) translationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.deleteTranslation(translationId, user);
  }
}
