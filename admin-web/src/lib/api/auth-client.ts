import { apiFetch } from './http';
import { SuccessResponse, User } from '@/types/api';

export interface LoginResponse { accessToken: string; tokenType: 'Bearer'; expiresIn: string; user: User }
export const authClient = {
  login: (email: string, password: string) => apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
  me: () => apiFetch<{ user: User }>('/auth/me'),
};
