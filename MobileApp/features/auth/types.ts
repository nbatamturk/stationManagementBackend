export type AuthUserRole = 'admin' | 'operator' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthUserRole;
  isActive: boolean;
}

export interface LoginResponseData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  session: {
    strategy: 'jwt-bearer';
    sessionVersion: 1;
    accessTokenExpiresIn: string;
    refreshTokenEnabled: boolean;
    refreshEndpoint: string | null;
  };
  user: AuthUser;
}

export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: AuthUser | null;
}
