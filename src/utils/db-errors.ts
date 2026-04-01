type PgErrorLike = Error & {
  cause?: unknown;
  code?: string;
  constraint?: string;
  detail?: string;
};

export const getPgError = (error: unknown): PgErrorLike | null => {
  let current = error;

  while (typeof current === 'object' && current !== null) {
    const candidate = current as PgErrorLike;

    if (typeof candidate.code === 'string') {
      return candidate;
    }

    current = candidate.cause;
  }

  return null;
};

export const isUniqueViolation = (error: unknown) => getPgError(error)?.code === '23505';

export const isForeignKeyViolation = (error: unknown) => getPgError(error)?.code === '23503';
