import { Controller, Post, Get, Body, Req, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/login.dto';
import { Public } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { UserContext } from '../../core/rbac/scope.service';
import { ApiStandardResponse } from '../../core/swagger/api-standard-response.decorator';
import {
  LoginResponseDto,
  RefreshResponseDto,
  UserMeResponseDto,
  ActionSuccessResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Connexion utilisateur et émission de tokens' })
  @ApiStandardResponse({
    type: LoginResponseDto,
    description: 'Authentification réussie, émission des jetons d’accès et de rafraîchissement',
  })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Échange du refresh token avec rotation' })
  @ApiStandardResponse({
    type: RefreshResponseDto,
    description: 'Nouveau token d’accès et refresh token renouvelé par rotation',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.refresh(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion et révocation de la session' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Session révoquée avec succès',
  })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil et périmètre de l'utilisateur connecté" })
  @ApiStandardResponse({
    type: UserMeResponseDto,
    description: 'Détails du compte, rôles, permissions et périmètre de sites/files autorisés',
  })
  async getMe(@CurrentUser() user: UserContext) {
    return this.authService.getMe(user);
  }

  @Post('password/change')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changement de mot de passe' })
  @ApiStandardResponse({
    type: ActionSuccessResponseDto,
    description: 'Mot de passe mis à jour avec succès',
  })
  async changePassword(
    @CurrentUser('userId') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }
}
