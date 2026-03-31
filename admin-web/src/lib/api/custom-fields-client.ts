import { CustomField, SuccessResponse } from '@/types/api';
import { apiFetch } from './http';

export const customFieldsClient = {
  list: (isActive?: boolean) => apiFetch<SuccessResponse<CustomField[]>>(`/custom-fields${isActive === undefined ? '' : `?isActive=${isActive}`}`),
  create: (payload: Partial<CustomField>) => apiFetch<SuccessResponse<CustomField>>('/custom-fields', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<CustomField>) => apiFetch<SuccessResponse<CustomField>>(`/custom-fields/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  setActive: (id: string, isActive: boolean) => apiFetch<SuccessResponse<CustomField>>(`/custom-fields/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
};
