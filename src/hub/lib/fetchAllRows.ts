type RowResult<T> = { data: T[] | null; error: { message?: string; code?: string } | null; count?: number | null };
type RowQuery<T> = PromiseLike<RowResult<T>> & {
  order(column: string, options?: { ascending?: boolean }): RowQuery<T>;
  range(from: number, to: number): RowQuery<T>;
  abortSignal(signal: AbortSignal): RowQuery<T>;
};

export const HISTORY_STALE_TIME = 5 * 60 * 1000;

/** Create a fresh filtered query for every page. Its final ID order is unique.
 * Use select(..., { count: 'exact' }) to detect lower server row caps too.
 * A failed later page rejects the entire result; totals never use partial data.
 */
export async function fetchAllRows<T>(createQuery: () => RowQuery<T>, options: { pageSize?: number; signal?: AbortSignal } = {}): Promise<T[]> {
  const pageSize = options.pageSize ?? 500;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Tamanho de página inválido.');
  const rows: T[] = [];
  let expectedCount: number | null = null;
  for (;;) {
    options.signal?.throwIfAborted();
    let query = createQuery().order('id', { ascending: true }).range(rows.length, rows.length + pageSize - 1);
    if (options.signal) query = query.abortSignal(options.signal);
    const result = await query;
    if (result.error) {
      // A count-less PostgREST query can signal an empty final range as 416.
      if (result.error.code === 'PGRST103' && rows.length > 0 && expectedCount === null) return rows;
      throw result.error;
    }
    if (!Array.isArray(result.data)) throw new Error('Resposta incompleta ao consultar o histórico.');
    expectedCount = result.count ?? expectedCount;
    if (result.data.length === 0) {
      if (result.count != null && result.count > rows.length) throw new Error('O histórico mudou durante a consulta. Atualize os dados.');
      return rows;
    }
    rows.push(...result.data);
    if (result.count != null && rows.length >= result.count) return rows;
    // Do not stop on a short page: the server may enforce a smaller row cap.
  }
}
