export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  details: unknown;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApiPaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export const successResponse = <T>(data: T): ApiSuccessResponse<T> => ({
  data,
});

export const errorResponse = (
  code: string,
  message: string,
  details: unknown = null,
): ApiErrorResponse => ({
  code,
  message,
  details,
});

export const paginatedResponse = <T>(data: T[], meta: PaginationMeta): ApiPaginatedResponse<T> => ({
  data,
  meta,
});
