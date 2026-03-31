export type ApiSuccessResponse<T> = {
  data: T;
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

export const paginatedResponse = <T>(data: T[], meta: PaginationMeta): ApiPaginatedResponse<T> => ({
  data,
  meta,
});
