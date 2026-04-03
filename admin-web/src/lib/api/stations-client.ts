import {
  DeleteResult,
  PaginatedResponse,
  Station,
  StationCatalogBrand,
  StationCatalogModel,
  StationConfig,
  StationConnectorInput,
  StationWritePayload,
  SuccessResponse,
} from '@/types/api';
import { apiFetch } from './http';

type QueryValue = string | number | boolean | undefined;

type StationBrandPayload = {
  name: string;
  isActive?: boolean;
};

type StationModelPayload = {
  brandId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};

const buildQuery = (query: Record<string, QueryValue>) =>
  new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

export const stationsClient = {
  list: (query: Record<string, QueryValue>) => apiFetch<PaginatedResponse<Station>>(`/stations?${buildQuery(query)}`),
  get: (id: string) => apiFetch<SuccessResponse<Station>>(`/stations/${id}`),
  getConfig: () => apiFetch<SuccessResponse<StationConfig>>('/stations/config'),
  create: (payload: StationWritePayload) =>
    apiFetch<SuccessResponse<Station>>('/stations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<StationWritePayload>) =>
    apiFetch<SuccessResponse<Station>>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  applyModelTemplate: (id: string) =>
    apiFetch<SuccessResponse<Station>>(`/stations/${id}/apply-model-template`, { method: 'POST' }),
  createBrand: (payload: StationBrandPayload) =>
    apiFetch<SuccessResponse<StationCatalogBrand>>('/stations/brands', { method: 'POST', body: JSON.stringify(payload) }),
  updateBrand: (id: string, payload: Partial<StationBrandPayload>) =>
    apiFetch<SuccessResponse<StationCatalogBrand>>(`/stations/brands/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBrand: (id: string) =>
    apiFetch<SuccessResponse<DeleteResult>>(`/stations/brands/${id}`, { method: 'DELETE' }),
  createModel: (payload: StationModelPayload) =>
    apiFetch<SuccessResponse<StationCatalogModel>>('/stations/models', { method: 'POST', body: JSON.stringify(payload) }),
  updateModel: (id: string, payload: Partial<StationModelPayload>) =>
    apiFetch<SuccessResponse<StationCatalogModel>>(`/stations/models/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteModel: (id: string) =>
    apiFetch<SuccessResponse<DeleteResult>>(`/stations/models/${id}`, { method: 'DELETE' }),
  replaceModelTemplate: (id: string, connectors: StationConnectorInput[]) =>
    apiFetch<SuccessResponse<StationCatalogModel>>(`/stations/models/${id}/template`, {
      method: 'PUT',
      body: JSON.stringify({ connectors }),
    }),
  archive: (id: string) => apiFetch<SuccessResponse<Station>>(`/stations/${id}/archive`, { method: 'POST' }),
  remove: (id: string) =>
    apiFetch<SuccessResponse<DeleteResult>>(`/stations/${id}`, { method: 'DELETE' }),
};
