/**
 * Executes a Supabase query with pagination loop using `.range()` to bypass the 1000 row limit.
 * @param queryFn A function returning a fresh query builder.
 * @param limit The page size (default 1000)
 */
export async function paginateQuery<T>(queryFn: () => any, limit: number = 1000): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
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
