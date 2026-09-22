import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../rbac/scope.service';

/**
 * Décorateur pour injecter l'utilisateur authentifié dans les contrôleurs
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
