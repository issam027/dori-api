import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import {
  ApiDoriOkResponse,
  ApiDoriErrorResponses,
  ApiDoriPublicErrorResponses,
} from '../../core/swagger/api-dori-response.decorator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  LoginResponseDto,
  TokensResponseDto,
  CurrentUserResponseDto,
  SimpleMessageResponseDto,
} from './dto/auth-response.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentification')
@ApiDoriErrorResponses({ omit401: false, omit403: true })
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getRefreshCookieOptions() {
    const refreshTokenExpiresInDays =
      this.configService.get<number>('jwt.refreshTokenExpiresInDays') ?? 30;

    return {
      httpOnly: true,
      secure: this.configService.get<string>('nodeEnv') === 'production',
      sameSite: 'strict' as const,
      maxAge: refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion',
    description:
      'Authentifie un utilisateur et retourne un access token JWT + un refresh token (aussi positionné en cookie HttpOnly).',
  })
  @ApiBody({ type: LoginDto })
  @ApiDoriOkResponse(
    LoginResponseDto,
    'Connexion réussie avec token JWT et profil',
  )
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit422: true,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    res.cookie(
      'refreshToken',
      result.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renouveler les tokens',
    description:
      'Échange un refresh token contre une nouvelle paire access/refresh (rotation).',
  })
  @ApiBody({ type: RefreshDto })
  @ApiDoriOkResponse(TokensResponseDto, 'Nouveaux tokens émis avec succès')
  @ApiDoriPublicErrorResponses({
    include401: true,
    omit404: true,
    omit409: true,
    omit422: true,
  })
  async refresh(
    @Body() refreshDto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshDto.refreshToken || req.cookies?.refreshToken;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.refresh(token, ipAddress, userAgent);

    res.cookie(
      'refreshToken',
      result.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Déconnexion',
    description:
      'Invalide la session courante du caller (sans body).\n\n' +
      '**global_logout** : poster `{"userId": <votre_id>}` pour révoquer toutes vos sessions.\n\n' +
      '**Force-disconnect** (manager/admin/root) : poster `{"userId": <id_cible>}` pour déconnecter un utilisateur hiérarchiquement inférieur.',
  })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiDoriOkResponse(SimpleMessageResponseDto, 'Session terminée avec succès')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() logoutDto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refreshToken');
    return this.authService.logout(user, logoutDto);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: "Profil et permissions de l'utilisateur connecté",
    description:
      "Retourne le profil détaillé, les rôles et permissions effectives de l'utilisateur authentifié.",
  })
  @ApiDoriOkResponse(CurrentUserResponseDto, 'Profil et permissions')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Changer son mot de passe',
    description:
      "Permet à l'utilisateur connecté de changer son mot de passe actuel.",
  })
  @ApiDoriOkResponse(
    SimpleMessageResponseDto,
    'Mot de passe modifié avec succès',
  )
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }
}
