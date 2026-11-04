import {
  CanActivate,
  ExecutionContext,
  Injectable,
  MessageEvent,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { DoriException } from '../../core/errors/dori.exception';
import { RealtimeSessionDto } from './dto/realtime-session.dto';
import { RealtimeSessionService } from './realtime-session.service';

export interface RealtimeSessionRequest extends Request {
  user?: AuthenticatedUser;
  realtimeEvents?: Observable<MessageEvent>;
}

@Injectable()
export class RealtimeSessionGuard implements CanActivate {
  private readonly validation = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
  constructor(private readonly session: RealtimeSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RealtimeSessionRequest>();
    if (!request.user) throw new DoriException('UNAUTHENTICATED');
    // Guards finish before Nest flushes SSE headers. Body pipes in the handler
    // run too late to return a proper 400/403/410 instead of a 200 event stream.
    const selection: RealtimeSessionDto = await this.validation.transform(
      request.body,
      { type: 'body', metatype: RealtimeSessionDto },
    );
    request.realtimeEvents = await this.session.stream(
      selection,
      request.user,
      request.get('X-Registration-Token') ?? '',
    );
    return true;
  }
}
