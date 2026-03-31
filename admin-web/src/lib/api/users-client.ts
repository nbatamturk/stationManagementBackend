import { PaginatedResponse, SuccessResponse, User } from '@/types/api';
import { apiFetch } from './http';

export const usersClient = {
  list: (query: Record<string, string | number | boolean | undefined>) => apiFetch<PaginatedResponse<User>>(`/users?${new URLSearchParams(Object.entries(query).filter(([,v]) => v !== undefined).map(([k,v])=>[k,String(v)]))}`),
  get: (id: string) => apiFetch<SuccessResponse<User>>(`/users/${id}`),
  create: (payload: { email: string; fullName: string; password: string; role: string; isActive: boolean }) => apiFetch<SuccessResponse<User>>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<User> & { password?: string }) => apiFetch<SuccessResponse<User>>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setActive: (id: string, isActive: boolean) => apiFetch<SuccessResponse<User>>(`/users/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
};
