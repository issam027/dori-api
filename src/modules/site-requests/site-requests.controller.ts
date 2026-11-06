import {
  Controller,
  Get,
  Header,
  Module,
  Param,
  Query,
  Req,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

@ApiTags('Site requests')
@ApiBearerAuth()
@Controller('api/v1/site-requests')
export class SiteRequestsController {
  private async read(user: AuthenticatedUser, path: string) {
    if (!user?.roles?.includes('root'))
      throw new ForbiddenException('Accès réservé au rôle root.');
    if (process.env.DORIFY_DEPLOYMENT_MODE !== 'cloud')
      throw new NotFoundException();
    const base = process.env.SITE_REQUESTS_URL;
    const secret = process.env.SITE_REQUESTS_SECRET;
    if (!base || !secret)
      throw new ServiceUnavailableException(
        'Consultation des demandes indisponible.',
      );
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        headers: { 'X-Dorify-Service-Token': secret },
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (response.status === 404) throw new NotFoundException();
      if (!response.ok) throw new Error('Site unavailable');
      return await response.json();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'Consultation des demandes indisponible.',
      );
    }
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Consulter les demandes JSON du site (root, cloud uniquement)',
  })
  list(
    @Req() request: { user: AuthenticatedUser },
    @Query('page') page = '1',
    @Query('search') search = '',
  ) {
    if (!/^\d{1,6}$/.test(page) || Number(page) < 1 || search.length > 160)
      throw new BadRequestException();
    return this.read(
      request.user,
      `?page=${page}&search=${encodeURIComponent(search)}`,
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Détail d’une demande du site (root, cloud uniquement)',
  })
  detail(@Req() request: { user: AuthenticatedUser }, @Param('id') id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException();
    return this.read(request.user, `/${id}`);
  }
}

@Module({ controllers: [SiteRequestsController] })
export class SiteRequestsModule {}
