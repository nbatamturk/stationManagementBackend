import { Platform } from 'react-native';

import { getAccessToken, handleUnauthorized, setAccessToken } from '@/lib/auth/session-store';
import { clearStoredAccessToken } from '@/lib/auth/token-storage';

import { ApiError } from './errors';

type QueryValue = string | number | boolean | null | undefined;

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  query?: Record<string, QueryValue>;
};

type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: unknown;
};

const FALLBACK_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || FALLBACK_API_BASE_URL;

const buildQueryString = (query?: Record<string, QueryValue>): string => {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    params.append(key, String(rawValue));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

const hasJsonBody = (body: BodyInit | null | undefined): boolean => {
  return typeof body === 'string';
};

const clearAuthState = async (): Promise<void> => {
  setAccessToken(null);
  await clearStoredAccessToken();
  handleUnauthorized();
};

export const getApiBaseUrl = (): string => API_BASE_URL;

export async function apiFetch<T>(
  path: string,
  { auth = true, query, ...init }: ApiFetchOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (hasJsonBody(init.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}${buildQueryString(query)}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJsonResponse = contentType.includes('application/json');
  const payload = isJsonResponse
    ? ((await response.json().catch(() => null)) as T | ApiErrorPayload | null)
    : null;

  if (!response.ok) {
    const apiErrorPayload = payload as ApiErrorPayload | null;

    if (response.status === 401 && auth) {
      await clearAuthState();
    }

    throw new ApiError(
      apiErrorPayload?.message ?? `HTTP ${response.status}`,
      response.status,
      apiErrorPayload?.code,
      apiErrorPayload?.details,
    );
  }

  return payload as T;
}
