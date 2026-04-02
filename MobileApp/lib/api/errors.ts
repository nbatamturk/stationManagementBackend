export type ApiErrorKind = 'network' | 'unauthorized' | 'rate_limit' | 'server' | 'client';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  kind: ApiErrorKind;
  isRetryable: boolean;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    options?: {
      kind?: ApiErrorKind;
      isRetryable?: boolean;
      retryAfterSeconds?: number | null;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.kind = options?.kind ?? 'client';
    this.isRetryable = options?.isRetryable ?? false;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const isUnauthorizedError = (error: unknown): error is ApiError =>
  isApiError(error) && error.status === 401;

export const isRetryableApiError = (error: unknown): error is ApiError =>
  isApiError(error) && error.isRetryable;

export const getApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isApiError(error) && error.message.trim()) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};
