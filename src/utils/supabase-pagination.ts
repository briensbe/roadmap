export interface PaginateOptions {
  limit?: number;
  maxIterations?: number;
}

/**
 * Contrat minimal d'un query builder Supabase paginable via `.range()`.
 * Typé structurellement pour ne pas dépendre des génériques internes de PostgREST.
 */
export interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>;
}

/**
 * Executes a Supabase query with pagination loop using `.range()` to bypass the 1000 row limit.
 *
 * ⚠️ La requête retournée par `queryFn` DOIT inclure un `.order()` déterministe et unique
 * (ex: `.order('id', { ascending: true })` en tie-breaker), sans quoi PostgreSQL peut renvoyer
 * des doublons ou omettre des lignes entre deux pages.
 *
 * @param queryFn A function returning a fresh, ordered query builder.
 * @param options Configuration options.
 */
export async function paginateQuery<T>(
  queryFn: () => RangeableQuery<T>,
  options?: PaginateOptions
): Promise<T[]> {
  const limit = options?.limit ?? 1000;
  const maxIterations = options?.maxIterations ?? 200;

  const allData: T[] = [];
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
