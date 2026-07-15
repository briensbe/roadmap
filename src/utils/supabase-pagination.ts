export interface PaginateOptions {
  limit?: number;
  maxIterations?: number;
}

/**
 * Executes a Supabase query with pagination loop using `.range()` to bypass the 1000 row limit.
 * @param queryFn A function returning a fresh query builder.
 * @param options Configuration options.
 */
export async function paginateQuery<T>(
  queryFn: () => any,
  options?: PaginateOptions
): Promise<T[]> {
  const limit = options?.limit ?? 1000;
  const maxIterations = options?.maxIterations ?? 200;

  let allData: T[] = [];
  let from = 0;
  let hasMore = true;
  
  let iterations = 0;

  while (hasMore) {
    iterations++;
    if (iterations > maxIterations) {
      const errMsg = `Safety limit exceeded (${maxIterations} pages). Query aborted to prevent an infinite loop.`;
      console.error(`[Supabase Pagination Error] ${errMsg}`);
      throw new Error(errMsg);
    }

    const { data, error } = await queryFn().range(from, from + limit - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...data);
      if (data.length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}
