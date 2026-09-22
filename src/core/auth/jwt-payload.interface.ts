export interface JwtPayload {
  sub: number;
  roles: string[];
  permissions: string[];
  userType: 'human' | 'kiosk';
  iat?: number;
  exp?: number;
  jti?: string;
}
