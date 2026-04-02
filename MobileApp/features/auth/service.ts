import { apiFetch } from '@/lib/api/http';

import type {
  AuthUser,
  ChangePasswordResponseData,
  LoginResponseData,
} from './types';

type SuccessResponse<T> = {
  data: T;
};

export const login = async (
  email: string,
  password: string,
): Promise<LoginResponseData> => {
  const response = await apiFetch<SuccessResponse<LoginResponseData>>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false,
    },
  );

  return response.data;
};

export const getCurrentUser = async (): Promise<AuthUser> => {
  const response = await apiFetch<SuccessResponse<{ user: AuthUser }>>('/auth/me');
  return response.data.user;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResponseData> => {
  const response = await apiFetch<SuccessResponse<ChangePasswordResponseData>>(
    '/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    },
  );

  return response.data;
};
