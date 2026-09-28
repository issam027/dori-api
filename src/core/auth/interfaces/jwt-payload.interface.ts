export interface JwtPayload {
  sub: number;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface AuthenticatedUser {
  userId: number;
  username: string;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
}
