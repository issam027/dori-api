export interface JwtPayload {
  sub: number;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  iat?: number;
  exp?: number;
  jti?: string;
  /** UUID de la session (`dori_user_session.session_id`) liée à ce JWT — SEC-02 */
  sid: string;
}

export interface AuthenticatedUser {
  userId: number;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  /** UUID de la session liée au JWT courant — SEC-02 */
  sessionId?: string;
}
