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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { TranslationsService } from './translations.service';
import {
  CreateTranslationDto,
  UpdateTranslationDto,
  TranslationFilterDto,
  BundleQueryDto,
} from './dto/translation.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../core/rbac/decorators/require-permission.decorator';

@ApiTags('Translations')
@ApiBearerAuth('bearer')
@Controller('api/v1/translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get('bundle')
  async getBundle(
    @Query() query: BundleQueryDto,
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

  @Get()
  @RequirePermission('translation_manage')
  async findTranslations(@Query() filter: TranslationFilterDto) {
    return this.translationsService.findTranslations(filter);
  }

  @Post()
  @RequirePermission('translation_manage')
  @HttpCode(HttpStatus.CREATED)
  async createTranslation(
    @Body() dto: CreateTranslationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.createTranslation(dto, user);
  }

  @Patch(':translationId')
  @RequirePermission('translation_manage')
  async updateTranslation(
    @Param('translationId', ParseIntPipe) translationId: number,
    @Body() dto: UpdateTranslationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.updateTranslation(translationId, dto, user);
  }

  @Delete(':translationId')
  @RequirePermission('translation_manage')
  async deleteTranslation(
    @Param('translationId', ParseIntPipe) translationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.deleteTranslation(translationId, user);
  }
}
