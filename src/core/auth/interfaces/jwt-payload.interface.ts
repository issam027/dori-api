import type { SessionId, UserId } from '../../types/guid';

export interface JwtPayload {
  sub: UserId;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  iat?: number;
  exp?: number;
  jti?: string;
  /** UUID de la session (`dorify.dori_user_session.session_id`) liÃ©e Ã  ce JWT â€” SEC-02 */
  sid: SessionId;
}

export interface AuthenticatedUser {
  userId: UserId;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  /** UUID de la session liÃ©e au JWT courant â€” SEC-02 */
  sessionId?: SessionId;
}
