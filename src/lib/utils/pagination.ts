export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function normalizePagination(
  input: PaginationInput = {},
  options?: {
    defaultLimit?: number;
    maxLimit?: number;
  }
): NormalizedPagination {
  const defaultLimit = options?.defaultLimit ?? 50;
  const maxLimit = options?.maxLimit ?? 100;

  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page as number)) : 1;
  const rawLimit = Number.isFinite(input.limit) ? Math.floor(input.limit as number) : defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}
