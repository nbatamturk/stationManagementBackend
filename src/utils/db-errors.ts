type PgErrorLike = Error & {
  code?: string;
  constraint?: string;
  detail?: string;
};

export const isUniqueViolation = (error: unknown): error is PgErrorLike => {
  return typeof error === 'object' && error !== null && (error as PgErrorLike).code === '23505';
};

export const isForeignKeyViolation = (error: unknown): error is PgErrorLike => {
  return typeof error === 'object' && error !== null && (error as PgErrorLike).code === '23503';
};
