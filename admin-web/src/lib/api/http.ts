import { getToken } from '@/lib/auth/token';
import { ApiError } from '@/types/api';

const API_PROXY_PREFIX = '/api/proxy';

export async function apiFetch<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;

  if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_PROXY_PREFIX}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(
      `API request could not reach the admin proxy for ${path}. Check admin-web .env API_BASE_URL/NEXT_PUBLIC_API_BASE_URL and confirm the backend is running.`,
    );
  }

  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? ((await response.json().catch(() => null)) as ApiError | null) : null;
    const fallbackMessage = isJson ? '' : await response.text().catch(() => '');

    throw new Error((payload?.message ?? fallbackMessage) || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
