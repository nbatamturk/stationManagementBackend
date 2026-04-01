import { apiFetch } from './http';
import { SuccessResponse, User } from '@/types/api';

export interface LoginResponse {
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
  user: User;
}
export const authClient = {
  login: async (email: string, password: string) =>
    (await apiFetch<SuccessResponse<LoginResponse>>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false)).data,
  me: async () => (await apiFetch<SuccessResponse<{ user: User }>>('/auth/me')).data,
};
